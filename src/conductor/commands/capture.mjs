import logCommandOutput from "./log-output.mjs";
import runProcess from "./process.mjs";

export default function runCommandCapture(command, args, options = {}) {
  return runProcess(command, args, {
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    stdio: ["ignore", "pipe", "pipe"],
    onStdout: (chunk) => {
      if (!options.quiet && !options.logPath) process.stdout.write(chunk);
    },
    onStderr: (chunk) => {
      if (!options.quiet && !options.logPath) process.stderr.write(chunk);
    },
    onError: (error) =>
      options.logPath
        ? logCommandOutput({
            file: options.logPath,
            name: options.logName,
            stderr: error.message,
            env: options.env || process.env,
          })
        : undefined,
    onExit: async ({ code, stdout, stderr }) => {
      const safe = options.logPath
        ? await logCommandOutput({
            file: options.logPath,
            name: options.logName,
            stdout,
            stderr,
            env: options.env || process.env,
          })
        : { stdout, stderr };
      if (!options.quiet && options.logPath) {
        process.stdout.write(safe.stdout);
        process.stderr.write(safe.stderr);
      }
      return code === 0 ? "" : `: ${safe.stderr}`;
    },
  });
}
