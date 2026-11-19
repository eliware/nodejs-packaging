import { spawn as spawnProcess } from "node:child_process";

function runConductor(mode, { root, conductor, spawn = spawnProcess }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [conductor, mode], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`conductor exited with code ${code ?? "signal"} ${signal || ""}`)),
    );
  });
}

export default function conductorRunnerModule() {
  return { runConductor };
}
