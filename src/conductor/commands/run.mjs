import runLoggedCommand from "./logged/run.mjs";
import runProcess from "./process.mjs";

export default function runCommand(command, args, options = {}) {
  if (options.logPath) return runLoggedCommand(command, args, options);
  return runProcess(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    stdio: "inherit",
    onStdout: () => {},
    onStderr: () => {},
    onError: () => {},
    onExit: async () => "",
  }).then(({ code }) => ({ code }));
}
