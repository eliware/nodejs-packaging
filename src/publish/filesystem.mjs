import { createHash } from "node:crypto";
import {
  cp,
  lstat as statLink,
  mkdir,
  readdir,
  rename,
  rm,
  readFile,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
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

async function replacePointer(pointer, target) {
  await mkdir(path.dirname(pointer), { recursive: true });
  if (await exists(pointer)) await rm(pointer, { recursive: true, force: true });
  await symlink(path.relative(path.dirname(pointer), target), pointer);
}

async function atomicCopy(source, destination) {
  const temporary = `${destination}.tmp-${process.pid}`;
  await cp(source, temporary);
  await rename(temporary, destination);
}

async function hashFile(file) {
  const hash = createHash("sha256");
  hash.update(await readFile(file));
  return hash.digest("hex");
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function listFiles(directory, exclude = new Set(), relative = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (exclude.has(name)) continue;
    if (entry.isDirectory()) files.push(...(await listFiles(file, exclude, name)));
    else if (entry.isFile())
      files.push({ path: name, sha256: await hashFile(file), size: (await stat(file)).size });
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export default function publishFilesystemModule() {
  return { exists, replacePointer, atomicCopy, hashFile, writeJson, listFiles };
}
