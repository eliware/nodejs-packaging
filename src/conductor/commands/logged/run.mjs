import runProcess from "../process.mjs";
import writeRedactedCommandOutput from "./output.mjs";

export default function runLoggedCommand(command, args, options) {
  const env = options.env || process.env;
  return runProcess(command, args, {
    cwd: options.cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    onStdout: () => {},
    onStderr: () => {},
    onError: (error) =>
      (async () => {
        await writeRedactedCommandOutput({
          file: options.logPath,
          name: options.logName,
          stderr: error.message,
          env,
        });
      })(),
    onExit: async ({ stdout, stderr }) => {
      const safe = await writeRedactedCommandOutput({
        file: options.logPath,
        name: options.logName,
        stdout,
        stderr,
        env,
      });
      process.stdout.write(safe.stdout);
      process.stderr.write(safe.stderr);
      return "";
    },
  }).then(({ code }) => ({ code }));
}
