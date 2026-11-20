import captureOutput from "./logged/capture/output.mjs";
import runProcess from "./process.mjs";

export default function runCommandCapture(command, args, options = {}) {
  return runProcess(command, args, {
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    stdio: ["ignore", "pipe", "pipe"],
    ...captureOutput(options),
  });
}
