import runProcess from "./process.mjs";
import redactOutput from "./redact-output.mjs";
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
      (async () => {
        const safe = redactOutput({ stderr: error.message, env });
        await writeCommandLog({ file: options.logPath, name: options.logName, ...safe });
      })(),
    onExit: async ({ stdout, stderr }) => {
      const safe = redactOutput({ stdout, stderr, env });
      await writeCommandLog({ file: options.logPath, name: options.logName, ...safe });
      process.stdout.write(safe.stdout);
      process.stderr.write(safe.stderr);
      return "";
    },
  }).then(({ code }) => ({ code }));
}
