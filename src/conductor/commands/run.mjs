import writeCommandLog from "./log.mjs";
import runProcess from "./process.mjs";
import redactCommandOutput from "./redact.mjs";

export default function runCommand(command, args, options = {}) {
  const logging = Boolean(options.logPath);
  return runProcess(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    stdio: logging ? ["ignore", "pipe", "pipe"] : "inherit",
    onStdout: () => {},
    onStderr: () => {},
    onError: (error) =>
      logging
        ? writeCommandLog({
            file: options.logPath,
            name: options.logName,
            stderr: redactCommandOutput(error.message, options.env || process.env),
          })
        : undefined,
    onExit: async ({ stdout, stderr }) => {
      if (!logging) return "";
      const safeStdout = redactCommandOutput(stdout, options.env || process.env);
      const safeStderr = redactCommandOutput(stderr, options.env || process.env);
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
