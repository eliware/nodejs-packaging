import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

function conductorRuntime({
  root,
  stateRoot,
  repositoryUrl,
  baseImage,
  runId,
  notifyConductor,
  commands,
}) {
  const { runCommand, runCommandCapture } = commands;
  async function checkpoint(title, description, fields) {
    console.log(`[conductor] checkpoint passed: ${title}`);
    await notifyConductor({
      title,
      description,
      status: "success",
      fields: [{ name: "Run", value: runId }, ...fields],
    });
  }

  async function acquireLock(lockPath) {
    await mkdir(stateRoot, { recursive: true });
    await mkdir(lockPath);
    await writeFile(
      path.join(lockPath, "owner.json"),
      `${JSON.stringify({ run_id: runId, pid: process.pid, started: new Date().toISOString() }, null, 2)}\n`,
    );
    return true;
  }

  async function releaseLock(lockPath) {
    await rm(lockPath, { recursive: true, force: true });
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
    return runCommand(process.execPath, [path.join(root, script), ...args], {
      cwd: root,
      env: { ...process.env, ...extraEnv },
    });
  }

  async function runNodeCapture(script, args = []) {
    return runCommandCapture(process.execPath, [path.join(root, script), ...args], { cwd: root });
  }

  return {
    acquireLock,
    releaseLock,
    checkpoint,
    saveState,
    getJson,
    getBaseImageDigest,
    waitForPublishedRelease,
    runNode,
    runNodeCapture,
  };
}

export default function conductorRuntimeModule() {
  return { conductorRuntime };
}
