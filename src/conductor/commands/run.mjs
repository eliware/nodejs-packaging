import { spawn } from "node:child_process";
import path from "node:path";

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? resolve({ code })
        : reject(
            new Error(
              `${path.basename(command)} exited with code ${code ?? "signal"} ${signal || ""}`,
            ),
          ),
    );
  });
}

export default function commandRunModule() {
  return { runCommand };
}
