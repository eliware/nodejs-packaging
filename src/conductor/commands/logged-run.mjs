import runProcess from "./process.mjs";
import redactCommandOutput from "./redact.mjs";
import writeCommandLog from "./log.mjs";

export default function runLoggedCommand(command, args, options) {
  const env = options.env || process.env;
  return runProcess(command, args, {
    cwd: options.cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    onStdout: () => {},
    onStderr: () => {},
    onError: (error) =>
      writeCommandLog({
        file: options.logPath,
        name: options.logName,
        stderr: redactCommandOutput(error.message, env),
      }),
    onExit: async ({ stdout, stderr }) => {
      const safeStdout = redactCommandOutput(stdout, env);
      const safeStderr = redactCommandOutput(stderr, env);
      await writeCommandLog({
        file: options.logPath,
        name: options.logName,
        stdout: safeStdout,
        stderr: safeStderr,
      });
      process.stdout.write(safeStdout);
      process.stderr.write(safeStderr);
      return "";
    },
  }).then(({ code }) => ({ code }));
}
