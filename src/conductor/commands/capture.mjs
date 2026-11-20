import captureOutput from "./logged/capture/output.mjs";
import runProcess from "./process.mjs";
import redactCommandOutput from "./redact.mjs";

export default async function runCommandCapture(command, args, options = {}) {
  const result = await runProcess(command, args, {
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    stdio: ["ignore", "pipe", "pipe"],
    ...captureOutput(options),
  });
  const env = options.env || process.env;
  return {
    ...result,
    stdout: redactCommandOutput(result.stdout, env),
    stderr: redactCommandOutput(result.stderr, env),
  };
}
