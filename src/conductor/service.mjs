import path from "node:path";
import { fileURLToPath } from "node:url";
import discordNotifierModule from "../discord-notifier.mjs";
import conductorRunnerModule from "./service/runner.mjs";
const { notifyConductor } = discordNotifierModule();
const { runConductor } = conductorRunnerModule();

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

export default function moduleApi() {
  return { runConductorService, main };
}
