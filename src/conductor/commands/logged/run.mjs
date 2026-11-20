import runProcess from "../process.mjs";
import createRedactedOutputHandlers from "./redacted-output.mjs";

export default function runLoggedCommand(command, args, options) {
  return runProcess(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    stdio: ["ignore", "pipe", "pipe"],
    ...createRedactedOutputHandlers(options),
  }).then(({ code }) => ({ code }));
}
