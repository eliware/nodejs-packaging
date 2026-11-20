import { spawn } from "node:child_process";
import path from "node:path";
import collectProcessOutput from "./output.mjs";

export default function runProcess(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.stdio,
    });
    const output = collectProcessOutput(child, options.onStdout, options.onStderr);
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
        const failureDetail = await options.onExit({ code, signal, ...output });
        if (code === 0) resolve({ code, ...output });
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
