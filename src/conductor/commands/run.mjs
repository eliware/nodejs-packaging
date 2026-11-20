import { spawn } from "node:child_process";
import path from "node:path";
import writeCommandLog from "./log.mjs";

export default function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const logging = Boolean(options.logPath);
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: logging ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    if (logging) {
      child.stdout.setEncoding("utf8").on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.setEncoding("utf8").on("data", (chunk) => {
        stderr += chunk;
      });
    }
    child.once("error", async (error) => {
      if (logging)
        await writeCommandLog({
          file: options.logPath,
          name: options.logName,
          stderr: error.message,
          env: options.env || process.env,
        });
      reject(error);
    });
    child.once("exit", async (code, signal) => {
      if (logging) {
        const safe = await writeCommandLog({
          file: options.logPath,
          name: options.logName,
          stdout,
          stderr,
          env: options.env || process.env,
        });
        process.stdout.write(safe.stdout);
        process.stderr.write(safe.stderr);
      }
      if (code === 0) resolve({ code });
      else
        reject(
          new Error(
            `${path.basename(command)} exited with code ${code ?? "signal"} ${signal || ""}`,
          ),
        );
    });
  });
}
