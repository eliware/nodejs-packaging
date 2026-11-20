import discordNotifierModule from "../../discord-notifier.mjs";
import runConductor from "../service/runner.mjs";
import runConductorService from "../service.mjs";
import resolveServicePaths from "./paths.mjs";

const { notifyConductor } = discordNotifierModule();

export default async function runService(dependencies = {}) {
  const { root, conductor } = resolveServicePaths(import.meta.url);
  const run = dependencies.run || ((mode) => runConductor(mode, { root, conductor }));
  const notify = dependencies.notify || notifyConductor;
  const succeeded = await runConductorService({ run, notify });
  if (!succeeded) process.exitCode = 1;
}
