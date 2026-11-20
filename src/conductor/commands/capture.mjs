import { spawn } from "node:child_process";
import path from "node:path";
import writeCommandLog from "./log.mjs";

export default function runCommandCapture(command, args, options = {}) {
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
      if (!options.quiet && !options.logPath) process.stdout.write(chunk);
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
      if (!options.quiet && !options.logPath) process.stderr.write(chunk);
    });
    child.once("error", async (error) => {
      if (options.logPath)
        await writeCommandLog({
          file: options.logPath,
          name: options.logName,
          stderr: error.message,
          env: options.env || process.env,
        });
      reject(error);
    });
    child.once("exit", async (code, signal) => {
      const safe = options.logPath
        ? await writeCommandLog({
            file: options.logPath,
            name: options.logName,
            stdout,
            stderr,
            env: options.env || process.env,
          })
        : { stdout, stderr };
      if (!options.quiet) {
        if (options.logPath) process.stdout.write(safe.stdout);
        if (options.logPath) process.stderr.write(safe.stderr);
      }
      if (code === 0) resolve({ code, stdout, stderr });
      else
        reject(
          new Error(
            `${path.basename(command)} exited with code ${code ?? "signal"} ${signal || ""}: ${safe.stderr}`,
          ),
        );
    });
  });
}
