import writeCommandLog from "./log.mjs";
import runProcess from "./process.mjs";

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
            stderr: error.message,
            env: options.env || process.env,
          })
        : undefined,
    onExit: async ({ stdout, stderr }) => {
      if (!logging) return "";
      const safe = await writeCommandLog({
        file: options.logPath,
        name: options.logName,
        stdout,
        stderr,
        env: options.env || process.env,
      });
      process.stdout.write(safe.stdout);
      process.stderr.write(safe.stderr);
      return "";
    },
  }).then(({ code }) => ({ code }));
}
