#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverLatestRelease } from "./discover-release.mjs";
import { discoverLatestNpm } from "./discover-npm.mjs";
import planRelease from "../src/conductor-plan.mjs";
import { hasDiscordWebhook, notifyConductor } from "./discord-notifier.mjs";
import { generateReleaseReport } from "./release-report.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(
  process.env.NODEJS_REPOSITORY_ROOT || "/eliware/nodejs-repository",
);
const repositoryUrl = (process.env.NODEJS_REPOSITORY_URL || "https://nodejs.eliware.org").replace(
  /\/$/,
  "",
);
const baseImage = "quay.io/centos/centos:stream10";
const mode = process.argv[2];
if (!new Set(["--dry-run", "--wet-run"]).has(mode))
  throw new Error("choose exactly one conductor mode: --dry-run or --wet-run");
const dryRun = mode === "--dry-run";
const stateRoot = path.resolve(
  process.env.NODEJS_CONDUCTOR_STATE_ROOT || "/var/lib/eliware/nodejs-packaging/conductor",
);
const lockPath = path.join(stateRoot, "lock");
const runId = `${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${randomUUID().slice(0, 8)}`;
let stage = "preflight";
let lockHeld = false;

async function main() {
  try {
    await mkdir(stateRoot, { recursive: true });
    await mkdir(lockPath);
    lockHeld = true;
    await writeFile(
      path.join(lockPath, "owner.json"),
      `${JSON.stringify({ run_id: runId, pid: process.pid, started: new Date().toISOString() }, null, 2)}\n`,
    );
    if (!dryRun && !hasDiscordWebhook())
      throw new Error("DISCORD_WEBHOOK is not configured in the conductor environment");
    if (!repositoryUrl.startsWith("https://"))
      throw new Error("NODEJS_REPOSITORY_URL must use HTTPS");
    const readiness = await getJson(`${repositoryUrl}/readyz`);
    if (readiness.status !== "ready") throw new Error("Node.js repository service is not ready");
    const catalog = await getJson(`${repositoryUrl}/metadata/catalog.json?run=${runId}`);
    if (catalog.metadata_version !== "0.1.0" || catalog.node_major !== 26)
      throw new Error("published catalog does not match the Node.js 26 release contract");

    stage = "upstream-check";
    const [release, npmRelease, currentBaseDigest] = await Promise.all([
      discoverLatestRelease(),
      discoverLatestNpm(),
      getBaseImageDigest(),
    ]);
    const published = catalog.stable?.latest;
    const publishedImage =
      catalog.images?.find((image) => image.node_version === published?.node_version) ||
      published?.image ||
      null;
    const plan = planRelease({
      latestNodeVersion: release.node_version,
      publishedNodeVersion: published?.node_version || null,
      latestNpmVersion: npmRelease.version,
      publishedNpmVersion: published?.npm?.version || null,
      publishedBaseImageDigest: publishedImage?.base_image_digest || null,
      currentBaseImageDigest: currentBaseDigest,
      publishedImageDigest: publishedImage?.digest || null,
    });
    const nodeVersion = plan.buildRpm ? release.node_version : published?.node_version;
    if (!nodeVersion)
      throw new Error("no Node.js RPM is published and discovery returned no version");
    await saveState({
      run_id: runId,
      stage,
      node_version: release.node_version,
      npm_version: npmRelease.version,
      base_image_digest: currentBaseDigest,
      plan,
    });
    if (!dryRun)
      await checkpoint(
        "Upstream checks passed",
        `Checked Node.js ${release.node_version}, npm ${npmRelease.version}, and the CentOS Stream 10 base image.`,
        [
          { name: "Published Node.js", value: published?.node_version || "none" },
          { name: "Latest Node.js", value: release.node_version },
          { name: "Published npm", value: published?.npm?.version || "none" },
          { name: "Latest npm", value: npmRelease.version },
          { name: "CentOS base digest", value: currentBaseDigest },
        ],
      );
    console.log(
      `[conductor] run=${runId} node=${release.node_version} base=${currentBaseDigest} plan=${plan.reason}`,
    );
    if (dryRun) {
      console.log(
        `[conductor] dry-run passed; ${plan.noOp ? "no build is needed" : `would build RPM=${plan.buildRpm} and image=${plan.buildImage}`}`,
      );
      return;
    }
    if (plan.noOp) {
      await checkpoint(
        "No updates found",
        "Node.js, npm, and the CentOS Stream 10 base image match the published release.",
        [
          { name: "Node.js", value: release.node_version },
          { name: "npm", value: npmRelease.version },
          { name: "Base digest", value: currentBaseDigest },
        ],
      );
      await notifyConductor({
        title: "Node.js conductor completed",
        description: "No updates were found. No packages, images, or repository files changed.",
        status: "success",
        fields: [
          { name: "Run", value: runId },
          { name: "Status", value: "No-op" },
          { name: "Node.js", value: release.node_version },
          { name: "npm", value: npmRelease.version },
        ],
      });
      return;
    }

    if (plan.buildRpm) {
      stage = "package-build";
      await runNode("bin/prepare-release.mjs", [
        "--version",
        nodeVersion,
        "--npm-version",
        npmRelease.version,
      ]);
      await runNode("bin/build-rpm.mjs", ["--version", nodeVersion]);
      const candidateResult = await runNodeCapture("bin/generate-repository.mjs", [
        "--version",
        nodeVersion,
      ]);
      const candidate = JSON.parse(candidateResult.stdout).output;
      await runNode("bin/publish-release.mjs", [
        "--version",
        nodeVersion,
        "--candidate",
        candidate,
        "--repository",
        repositoryRoot,
      ]);
      await waitForPublishedRelease(nodeVersion, npmRelease.version);
      await saveState({
        run_id: runId,
        stage: "package-published",
        node_version: nodeVersion,
        npm_version: npmRelease.version,
        base_image_digest: currentBaseDigest,
        candidate,
      });
      await checkpoint(
        "RPM checkpoint passed",
        "The official Node.js archive verified, the RPM built, and the signed repository generation became active.",
        [
          { name: "Node.js", value: nodeVersion },
          { name: "npm", value: npmRelease.version },
          { name: "Target", value: "CentOS Stream 10 EPEL x86_64" },
        ],
      );
    }

    stage = "image-build-publish";
    await runNode("bin/build-image.mjs", [
      "--version",
      nodeVersion,
      "--base-digest",
      currentBaseDigest,
      "--push",
    ]);
    const imageRecordPath = path.join(root, "artifacts/images", nodeVersion, "image.json");
    const image = JSON.parse(await readFile(imageRecordPath, "utf8"));
    if (!image.digest || image.published !== true)
      throw new Error("image build did not record a successful GHCR publication");
    await checkpoint(
      "Image checkpoint passed",
      "The CentOS Stream 10 image passed its Node.js smoke check and the GHCR push returned a digest.",
      [
        { name: "Image", value: `${image.repository}:${image.tag}` },
        { name: "Digest", value: image.digest },
        { name: "Base image", value: image.base_image_digest },
      ],
    );

    stage = "image-metadata";
    await runNode("bin/publish-image-record.mjs", [imageRecordPath]);
    const active = JSON.parse(
      await readFile(path.join(repositoryRoot, "metadata/active-generation.json"), "utf8"),
    );
    await checkpoint(
      "Repository metadata checkpoint passed",
      "The signed image record and release catalog now point to the active generation.",
      [
        { name: "Generation", value: active.generation },
        { name: "Image digest", value: image.digest },
      ],
    );

    stage = "release-report";
    const releaseReport = await generateReleaseReport({
      runId,
      repositoryRoot,
      nodeVersion,
      npmVersion: npmRelease.version,
      baseDigest: currentBaseDigest,
      imageDigest: image.digest,
      imageId: image.local_image_id,
      rpmSha256: image.rpm_sha256,
      reason: plan.reason,
      changed: true,
    });
    await checkpoint(
      "Release card passed",
      "The release card and full report are ready in the Node.js repository.",
      [
        { name: "Report", value: releaseReport.reportPath },
        { name: "Card", value: releaseReport.cardUrl },
      ],
    );

    stage = "repository-commit-push";
    await runNode("bin/commit-publish-repository.mjs", [], {
      NODEJS_REPOSITORY_ROOT: repositoryRoot,
    });
    await checkpoint(
      "Repository commit and push passed",
      "The completed release and report are committed and pushed to nodejs-repository.",
      [
        { name: "Generation", value: active.generation },
        { name: "Branch", value: "main" },
      ],
    );
    await notifyConductor({
      title: "Node.js conductor run completed",
      description:
        "The release checks, required package and image work, signed metadata, repository commit, and push completed successfully.",
      status: "success",
      fields: [
        { name: "Run", value: runId },
        { name: "Node.js", value: nodeVersion },
        { name: "npm", value: npmRelease.version },
        { name: "Plan", value: plan.reason },
        { name: "RPM", value: image.rpm_sha256 },
        { name: "Image", value: `${image.repository}:${image.tag}` },
        { name: "Digest", value: image.digest },
        { name: "Base image", value: currentBaseDigest },
        { name: "Repository generation", value: active.generation },
        { name: "Release report", value: releaseReport.cardUrl },
      ],
      cardUrl: releaseReport.cardUrl,
    });
    await saveState({
      run_id: runId,
      stage: "complete",
      node_version: nodeVersion,
      npm_version: npmRelease.version,
      base_image_digest: currentBaseDigest,
      image_digest: image.digest,
      generation: active.generation,
      completed: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[conductor] ${stage} failed: ${error.message}`);
    if (!dryRun)
      await notifyConductor({
        title: `Node.js conductor ${stage} failed`,
        description:
          "The release stopped at this checkpoint. The next timer run can retry after the reported issue is fixed.",
        status: "failure",
        fields: [
          { name: "Run", value: runId },
          { name: "Stage", value: stage },
          { name: "Error", value: error.message },
        ],
      });
    process.exitCode = 1;
  } finally {
    if (lockHeld) await rm(lockPath, { recursive: true, force: true });
  }
}

await main();

async function checkpoint(title, description, fields) {
  console.log(`[conductor] checkpoint passed: ${title}`);
  await notifyConductor({
    title,
    description,
    status: "success",
    fields: [{ name: "Run", value: runId }, ...fields],
  });
}
async function saveState(value) {
  const file = path.join(stateRoot, "last-run.json");
  const temporary = `${file}.tmp`;
  await writeFile(
    temporary,
    `${JSON.stringify({ ...value, updated: new Date().toISOString() }, null, 2)}\n`,
  );
  await rename(temporary, file);
}
async function getJson(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "cache-control": "no-cache" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${new URL(url).pathname} returned HTTP ${response.status}`);
  return response.json();
}
async function getBaseImageDigest() {
  await runCommand("docker", ["pull", baseImage]);
  const result = await runCommandCapture("docker", ["image", "inspect", baseImage], {
    quiet: true,
  });
  const inspect = JSON.parse(result.stdout)[0];
  const digest = inspect.RepoDigests?.find((item) =>
    item.startsWith("quay.io/centos/centos@sha256:"),
  );
  if (!digest) throw new Error(`Docker did not report an immutable digest for ${baseImage}`);
  return digest;
}
async function waitForPublishedRelease(version, npmVersion) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const catalog = await getJson(
        `${repositoryUrl}/metadata/catalog.json?version=${version}&attempt=${attempt}`,
      );
      if (
        catalog.stable?.latest?.node_version === version &&
        catalog.stable?.latest?.npm?.version === npmVersion
      )
        return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(
    `published catalog did not expose Node.js ${version} and npm ${npmVersion} after 60 seconds`,
  );
}
async function runNode(script, args = [], extraEnv = {}) {
  const result = await runCommand(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    env: { ...process.env, ...extraEnv },
  });
  return result;
}
async function runNodeCapture(script, args = []) {
  return runCommandCapture(process.execPath, [path.join(root, script), ...args], { cwd: root });
}
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? resolve({ code })
        : reject(
            new Error(
              `${path.basename(command)} exited with code ${code ?? "signal"} ${signal || ""}`,
            ),
          ),
    );
  });
}
function runCommandCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || root,
      env: options.env || process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
      if (!options.quiet) process.stdout.write(chunk);
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
      if (!options.quiet) process.stderr.write(chunk);
    });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? resolve({ code, stdout, stderr })
        : reject(
            new Error(
              `${path.basename(command)} exited with code ${code ?? "signal"} ${signal || ""}: ${stderr}`,
            ),
          ),
    );
  });
}
