import { createHash } from "node:crypto";
import { spawnSync as spawnProcessSync } from "node:child_process";
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

async function sign(file, fingerprint, home, spawnSync = spawnProcessSync) {
  const result = spawnSync(
    "gpg",
    ["--batch", "--yes", "--local-user", fingerprint, "--armor", "--detach-sign", file],
    { encoding: "utf8", env: { ...process.env, GNUPGHOME: home } },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`gpg exited with status ${result.status}: ${result.stderr}`);
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

async function buildIndex(directory, relative = "/", excludedPath = "") {
  const items = [];
  const directories = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    const entryPath = relative === "/" ? entry.name : `${relative.slice(1)}${entry.name}`;
    if (entryPath === excludedPath) continue;
    const info = await stat(file);
    const isDirectory = info.isDirectory();
    const item = {
      name: entry.name,
      type: isDirectory ? "directory" : "file",
      size: isDirectory ? null : info.size,
      modified: info.mtime.toISOString(),
      href: `${relative}${encodeURIComponent(entry.name)}${isDirectory ? "/" : ""}`,
    };
    if (!isDirectory) item.sha256 = await hashFile(file);
    items.push(item);
  }
  items.sort((left, right) => left.name.localeCompare(right.name));
  directories[relative] = { path: relative, entries: items, total: items.length };
  for (const item of items.filter((value) => value.type === "directory"))
    Object.assign(
      directories,
      await buildIndex(
        path.join(directory, item.name),
        `${relative}${encodeURIComponent(item.name)}/`,
        excludedPath,
      ),
    );
  return directories;
}

export default function publishFilesystemModule() {
  return { exists, replacePointer, atomicCopy, hashFile, writeJson, sign, listFiles, buildIndex };
}
