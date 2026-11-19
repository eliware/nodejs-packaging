import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

function createConductorConfig(argv, env, root) {
  const mode = argv[0];
  if (!new Set(["--dry-run", "--wet-run"]).has(mode))
    throw new Error("choose exactly one conductor mode: --dry-run or --wet-run");
  const stateRoot = path.resolve(
    env.NODEJS_CONDUCTOR_STATE_ROOT || "/var/lib/eliware/nodejs-packaging/conductor",
  );
  return {
    root: root || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
    repositoryRoot: path.resolve(env.NODEJS_REPOSITORY_ROOT || "/eliware/nodejs-repository"),
    repositoryUrl: (env.NODEJS_REPOSITORY_URL || "https://nodejs.eliware.org").replace(/\/$/, ""),
    baseImage: "quay.io/centos/centos:stream10",
    dryRun: mode === "--dry-run",
    stateRoot,
    lockPath: path.join(stateRoot, "lock"),
    runId: `${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${randomUUID().slice(0, 8)}`,
  };
}

export default function conductorConfigModule() {
  return { createConductorConfig };
}
