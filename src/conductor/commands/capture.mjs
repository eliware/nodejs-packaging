import { spawn } from "node:child_process";
import path from "node:path";

function runCommandCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: options.env || process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
      if (!options.quiet) process.stdout.write(chunk);
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
      if (!options.quiet) process.stderr.write(chunk);
    });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? resolve({ code, stdout, stderr })
        : reject(
            new Error(
              `${path.basename(command)} exited with code ${code ?? "signal"} ${signal || ""}: ${stderr}`,
            ),
          ),
    );
  });
}

export default function commandCaptureModule() {
  return { runCommandCapture };
}
