import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import discordNotifierModule from "../discord-notifier.mjs";
const { notifyConductor } = discordNotifierModule();

async function runConductorService({ run, notify, log = console }) {
  let phase = "dry-run";
  try {
    log.info("[conductor-service] starting dry-run preflight");
    await run("--dry-run");
    phase = "wet-run";
    log.info("[conductor-service] dry-run passed. Starting wet-run.");
    await run("--wet-run");
    log.info("[conductor-service] wet-run completed");
    return true;
  } catch (error) {
    log.error(`[conductor-service] ${phase} failed: ${error.message}`);
    await notify({
      title: `Node.js conductor ${phase} failed`,
      description:
        phase === "dry-run"
          ? "The preflight failed. The release run did not start."
          : "The release run stopped after preflight.",
      status: "failure",
      fields: [
        { name: "Phase", value: phase },
        { name: "Error", value: error.message },
      ],
    });
    return false;
  }
}

async function main(dependencies = {}) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const conductor = path.join(root, "bin/conductor.mjs");
  const run = dependencies.run || ((mode) => runConductor(mode, { root, conductor }));
  const notify = dependencies.notify || notifyConductor;
  const succeeded = await runConductorService({ run, notify });
  if (!succeeded) process.exitCode = 1;
}

function runConductor(mode, { root, conductor }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [conductor, mode], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`conductor exited with code ${code ?? "signal"} ${signal || ""}`)),
    );
  });
}

export default function moduleApi() {
  return { runConductorService, main };
}
