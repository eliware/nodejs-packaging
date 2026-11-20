import { spawn as spawnProcess } from "node:child_process";
import runProcess from "../commands/process.mjs";

export default function runConductor(mode, { root, conductor, spawn = spawnProcess }) {
  return runProcess(process.execPath, [conductor, mode], {
    cwd: root,
    env: { ...process.env, NODEJS_CONDUCTOR_SERVICE: "true" },
    stdio: "inherit",
    spawnProcess: spawn,
    failureName: "conductor",
  }).then(() => undefined);
}
