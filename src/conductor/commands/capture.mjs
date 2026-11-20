import writeCommandLog from "./log.mjs";
import runProcess from "./process.mjs";
import redactCommandOutput from "./redact.mjs";

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
        ? writeCommandLog({
            file: options.logPath,
            name: options.logName,
            stderr: redactCommandOutput(error.message, options.env || process.env),
          })
        : undefined,
    onExit: async ({ code, stdout, stderr }) => {
      const safe = options.logPath
        ? {
            stdout: redactCommandOutput(stdout, options.env || process.env),
            stderr: redactCommandOutput(stderr, options.env || process.env),
          }
        : { stdout, stderr };
      if (options.logPath)
        await writeCommandLog({ file: options.logPath, name: options.logName, ...safe });
      if (!options.quiet && options.logPath) {
        process.stdout.write(safe.stdout);
        process.stderr.write(safe.stderr);
      }
      return code === 0 ? "" : `: ${safe.stderr}`;
    },
  });
}
