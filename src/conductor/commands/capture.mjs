import redactOutput from "./redact-output.mjs";
import writeCommandLog from "./log.mjs";
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
            const safe = redactOutput({ stderr: error.message, env: options.env || process.env });
            await writeCommandLog({ file: options.logPath, name: options.logName, ...safe });
          })()
        : undefined,
    onExit: async ({ code, stdout, stderr }) => {
      const safe = options.logPath
        ? await (async () => {
            const safe = redactOutput({ stdout, stderr, env: options.env || process.env });
            await writeCommandLog({ file: options.logPath, name: options.logName, ...safe });
            return safe;
          })()
        : { stdout, stderr };
      if (!options.quiet && options.logPath) {
        process.stdout.write(safe.stdout);
        process.stderr.write(safe.stderr);
      }
      return code === 0 ? "" : `: ${safe.stderr}`;
    },
  });
}
