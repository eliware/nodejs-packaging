import path from "node:path";
import { fileURLToPath } from "node:url";
import discordNotifierModule from "../../discord-notifier.mjs";
import runConductor from "../service/runner.mjs";
import runConductorService from "../service.mjs";

const { notifyConductor } = discordNotifierModule();

export default async function runService(dependencies = {}) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const conductor = path.join(root, "bin/conductor.mjs");
  const run = dependencies.run || ((mode) => runConductor(mode, { root, conductor }));
  const notify = dependencies.notify || notifyConductor;
  const succeeded = await runConductorService({ run, notify });
  if (!succeeded) process.exitCode = 1;
}
