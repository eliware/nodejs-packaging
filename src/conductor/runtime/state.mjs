import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

function conductorState({
  stateRoot,
  runId,
  createDirectory = mkdir,
  readOwner = readFile,
  getInfo = stat,
  moveStaleLock = rename,
  isProcessAlive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      if (error.code === "ESRCH") return false;
      if (error.code === "EPERM") return true;
      throw error;
    }
  },
}) {
  async function acquireLock(lockPath) {
    await createDirectory(stateRoot, { recursive: true });
    try {
      await createDirectory(lockPath);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let stale = false;
      try {
        const owner = JSON.parse(await readOwner(path.join(lockPath, "owner.json"), "utf8"));
        stale = !(await isProcessAlive(owner.pid));
      } catch (ownerError) {
        if (ownerError.code !== "ENOENT" && !(ownerError instanceof SyntaxError)) throw ownerError;
        const lockInfo = await getInfo(lockPath);
        stale = Date.now() - lockInfo.mtimeMs > 5 * 60 * 1000;
      }
      if (!stale) throw new Error(`conductor lock is held: ${lockPath}`, { cause: error });
      const stalePath = `${lockPath}.stale-${runId}`;
      try {
        await moveStaleLock(lockPath, stalePath);
      } catch (moveError) {
        if (moveError.code === "ENOENT")
          throw new Error(`conductor lock is held: ${lockPath}`, { cause: moveError });
        throw moveError;
      }
      await rm(stalePath, { recursive: true, force: true });
      try {
        await createDirectory(lockPath);
      } catch (createError) {
        if (createError.code === "EEXIST")
          throw new Error(`conductor lock is held: ${lockPath}`, { cause: createError });
        throw createError;
      }
    }
    await writeFile(
      path.join(lockPath, "owner.json"),
      `${JSON.stringify({ run_id: runId, pid: process.pid, started: new Date().toISOString() }, null, 2)}\n`,
    );
    return true;
  }

  async function releaseLock(lockPath) {
    let owner;
    try {
      owner = JSON.parse(await readOwner(path.join(lockPath, "owner.json"), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
    if (owner.run_id !== runId || owner.pid !== process.pid) return false;
    await rm(lockPath, { recursive: true, force: true });
    return true;
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
