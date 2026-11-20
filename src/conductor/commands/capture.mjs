import logCapturedOutput from "./logged/captured-output.mjs";
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
        ? (async () => {
            await logCapturedOutput({
              file: options.logPath,
              name: options.logName,
              stderr: error.message,
              env: options.env || process.env,
              quiet: true,
            });
          })()
        : undefined,
    onExit: async ({ code, stdout, stderr }) => {
      const safe = options.logPath
        ? await logCapturedOutput({
            file: options.logPath,
            name: options.logName,
            stdout,
            stderr,
            env: options.env || process.env,
            quiet: options.quiet,
          })
        : { stdout, stderr };
      return code === 0 ? "" : `: ${safe.stderr}`;
    },
  });
}
