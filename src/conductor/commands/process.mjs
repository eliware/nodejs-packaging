import { spawn } from "node:child_process";
import path from "node:path";
import collectProcessOutput from "./output.mjs";

export default function runProcess(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = (options.spawnProcess || spawn)(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.stdio,
    });
    const output = collectProcessOutput(child, options.onStdout, options.onStderr);
    let processError;
    let errorHandling;
    child.once("error", (error) => {
      processError = error;
      errorHandling = Promise.resolve().then(() => options.onError?.(error));
    });
    child.once("close", async (code, signal) => {
      if (processError) {
        try {
          await errorHandling;
          reject(processError);
        } catch (loggingError) {
          reject(loggingError);
        }
        return;
      }
      try {
        const failureDetail = (await options.onExit?.({ code, signal, ...output })) || "";
        if (code === 0) resolve({ code, ...output });
        else
          reject(
            new Error(
              `${options.failureName || path.basename(command)} exited with code ${code ?? "signal"} ${signal || ""}${failureDetail}`,
            ),
          );
      } catch (error) {
        reject(error);
      }
    });
  });
}
