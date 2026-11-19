#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  if (process.argv[index].startsWith("--"))
    args.set(process.argv[index].slice(2), process.argv[++index]);
}
const version = args.get("version");
const pushImage = args.has("push");
if (!/^26\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version || ""))
  throw new Error("pass a stable Node.js 26 version with --version");

const repositoryUrl = process.env.NODEJS_REPOSITORY_URL;
if (!repositoryUrl)
  throw new Error("set NODEJS_REPOSITORY_URL to the production Node.js HTTP service");
const parsedRepositoryUrl = new URL(repositoryUrl);
if (
  parsedRepositoryUrl.protocol !== "https:" ||
  parsedRepositoryUrl.username ||
  parsedRepositoryUrl.password
)
  throw new Error("NODEJS_REPOSITORY_URL must use HTTPS and contain no credentials");
if (parsedRepositoryUrl.pathname !== "/" || parsedRepositoryUrl.search || parsedRepositoryUrl.hash)
  throw new Error("NODEJS_REPOSITORY_URL must name the production service root");
const repositoryBase = parsedRepositoryUrl.href.replace(/\/$/, "");
const catalogResponse = await fetch(`${repositoryBase}/metadata/catalog.json`, {
  signal: AbortSignal.timeout(30_000),
});
if (!catalogResponse.ok)
  throw new Error(
    `Node.js HTTP service returned HTTP ${catalogResponse.status} for the release catalog`,
  );
const catalog = await catalogResponse.json();
if (
  catalog.metadata_version !== "0.1.0" ||
  catalog.node_major !== 26 ||
  catalog.target?.architecture !== "x86_64"
)
  throw new Error("production catalog does not match the Node.js 26 x86_64 release contract");
const publishedRelease = catalog.stable?.latest;
if (
  publishedRelease?.node_version !== version ||
  publishedRelease.package?.name !== "eliware-node26"
)
  throw new Error(`production repository does not publish eliware-node26 ${version}`);
if (!/^[a-f\d]{64}$/.test(publishedRelease.package.sha256 || ""))
  throw new Error("production catalog does not provide a valid RPM checksum");

const sourceInput = JSON.parse(
  await readFile(path.join(root, ".state/sources", version, "release-input.json"), "utf8"),
);
const target = JSON.parse(await readFile(path.join(root, "build-config/target.json"), "utf8"));
const image = `${target.image}:${version}`;
const baseImage = "quay.io/centos/centos:stream10";
const pull = spawnSync("docker", ["pull", baseImage], { stdio: "inherit" });
if (pull.error) throw pull.error;
if (pull.status !== 0) throw new Error(`docker pull exited with status ${pull.status}`);
const baseInspect = JSON.parse(
  spawnSync("docker", ["image", "inspect", baseImage], { encoding: "utf8" }).stdout,
)[0];
const baseDigest = (baseInspect.RepoDigests || []).find((digest) =>
  digest.startsWith("quay.io/centos/centos@sha256:"),
);
if (!baseDigest) throw new Error(`Docker did not report an immutable digest for ${baseImage}`);
const expectedBaseDigest = args.get("base-digest");
if (expectedBaseDigest && baseDigest !== expectedBaseDigest)
  throw new Error(
    `CentOS base image changed during the conductor run: expected ${expectedBaseDigest}, found ${baseDigest}`,
  );
const context = await mkdtemp(path.join(os.tmpdir(), "centos10-node26-image-"));
try {
  const build = spawnSync(
    "docker",
    [
      "build",
      "--file",
      path.join(root, "containers/centos10-node26.Dockerfile"),
      "--build-arg",
      `NODE_VERSION=${version}`,
      "--build-arg",
      `SOURCE_SHA256=${sourceInput.source.sha256}`,
      "--build-arg",
      `BASE_IMAGE_DIGEST=${baseDigest.slice(baseDigest.lastIndexOf("@") + 1)}`,
      "--build-arg",
      `NODEJS_REPOSITORY_URL=${repositoryBase}`,
      "--build-arg",
      `REPOSITORY_GENERATION=${publishedRelease.generation_id}`,
      "--tag",
      image,
      context,
    ],
    { stdio: "inherit" },
  );
  if (build.error) throw build.error;
  if (build.status !== 0) throw new Error(`docker build exited with status ${build.status}`);

  const smoke = spawnSync("docker", ["run", "--rm", "--entrypoint", "node", image, "--version"], {
    encoding: "utf8",
  });
  if (smoke.error) throw smoke.error;
  if (smoke.status !== 0 || smoke.stdout.trim() !== `v${version}`)
    throw new Error(`image runtime check failed: ${smoke.stderr || smoke.stdout}`);
  for (const command of ["npm", "npx"]) {
    const check = spawnSync(
      "docker",
      ["run", "--rm", "--entrypoint", command, image, "--version"],
      {
        encoding: "utf8",
      },
    );
    if (check.error) throw check.error;
    if (check.status !== 0 || check.stdout.trim() !== publishedRelease.npm.version)
      throw new Error(`${command} runtime check failed: ${check.stderr || check.stdout}`);
  }

  let registryDigest = null;
  if (pushImage) {
    const push = spawnSync("docker", ["push", image], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    if (push.error) throw push.error;
    if (push.stdout) process.stdout.write(push.stdout);
    if (push.stderr) process.stderr.write(push.stderr);
    if (push.status !== 0) throw new Error(`docker push exited with status ${push.status}`);
    registryDigest =
      `${push.stdout}\n${push.stderr}`.match(/digest:\s*(sha256:[a-f0-9]{64})/i)?.[1] || null;
    if (!registryDigest) throw new Error("docker push completed without reporting an image digest");
  }

  const inspect = JSON.parse(
    spawnSync("docker", ["image", "inspect", image], { encoding: "utf8" }).stdout,
  )[0];
  const record = {
    repository: target.image,
    tag: version,
    digest: registryDigest,
    published: pushImage,
    local_image_id: inspect.Id,
    base_image: baseImage,
    base_image_digest: baseDigest,
    source_release: version,
    source_sha256: sourceInput.source.sha256,
    rpm_sha256: publishedRelease.package.sha256,
    repository_generation: publishedRelease.generation_id,
    validation: "passed",
    built_at: new Date().toISOString(),
  };
  const resultDir = path.resolve(
    args.get("output") || path.join(root, "artifacts/images", version),
  );
  await mkdir(resultDir, { recursive: true });
  await writeFile(path.join(resultDir, "image.json"), `${JSON.stringify(record, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
} finally {
  await rm(context, { recursive: true, force: true });
}
