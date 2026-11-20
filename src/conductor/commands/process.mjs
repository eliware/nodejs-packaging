import { spawn } from "node:child_process";
import path from "node:path";

export default function runProcess(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.stdio,
    });
    let stdout = "";
    let stderr = "";
    if (child.stdout)
      child.stdout.setEncoding("utf8").on("data", (chunk) => {
        stdout += chunk;
        options.onStdout(chunk);
      });
    if (child.stderr)
      child.stderr.setEncoding("utf8").on("data", (chunk) => {
        stderr += chunk;
        options.onStderr(chunk);
      });
    child.once("error", async (error) => {
      try {
        await options.onError(error);
        reject(error);
      } catch (loggingError) {
        reject(loggingError);
      }
    });
    child.once("exit", async (code, signal) => {
      try {
        const failureDetail = await options.onExit({ code, signal, stdout, stderr });
        if (code === 0) resolve({ code, stdout, stderr });
        else
          reject(
            new Error(
              `${path.basename(command)} exited with code ${code ?? "signal"} ${signal || ""}${failureDetail}`,
            ),
          );
      } catch (error) {
        reject(error);
      }
    });
  });
}
