import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

function conductorState({ stateRoot, runId }) {
  async function acquireLock(lockPath) {
    await mkdir(stateRoot, { recursive: true });
    await mkdir(lockPath);
    await writeFile(
      path.join(lockPath, "owner.json"),
      `${JSON.stringify({ run_id: runId, pid: process.pid, started: new Date().toISOString() }, null, 2)}\n`,
    );
    return true;
  }

  async function releaseLock(lockPath) {
    await rm(lockPath, { recursive: true, force: true });
  }

  async function saveState(value) {
    const file = path.join(stateRoot, "last-run.json");
    const temporary = `${file}.tmp`;
    await writeFile(
      temporary,
      `${JSON.stringify({ ...value, updated: new Date().toISOString() }, null, 2)}\n`,
    );
    await rename(temporary, file);
  }

  return { acquireLock, releaseLock, saveState };
}

export default function conductorStateModule() {
  return { conductorState };
}
