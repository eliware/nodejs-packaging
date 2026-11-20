import { lstat as statLink, mkdir, rename, rm, symlink } from "node:fs/promises";
import path from "node:path";

async function exists(file, lstat = statLink) {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function replacePointer(pointer, target, dependencies = {}) {
  const remove = dependencies.rm || rm;
  const move = dependencies.rename || rename;
  const pointerExists = dependencies.exists || exists;
  await mkdir(path.dirname(pointer), { recursive: true });
  const temporary = `${pointer}.tmp-${process.pid}`;
  await remove(temporary, { recursive: true, force: true });
  await symlink(path.relative(path.dirname(pointer), target), temporary);
  try {
    await move(temporary, pointer);
  } catch (error) {
    await remove(temporary, { force: true });
    if ((await pointerExists(pointer)) && error.code === "EEXIST")
      throw new Error(`cannot atomically replace repository pointer: ${pointer}`, { cause: error });
    throw error;
  }
}

export default function pointerOperations() {
  return { exists, replacePointer };
}
