import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

async function exists(file, statFile = stat) {
  try {
    await statFile(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function hashFile(file) {
  const hash = createHash("sha256");
  hash.update(await readFile(file));
  return hash.digest("hex");
}

async function listFiles(directory, relative = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await listFiles(file, name)));
    else if (entry.isFile()) {
      const info = await stat(file);
      files.push({ path: name, sha256: await hashFile(file), size: info.size });
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function buildIndex(directory, relative = "/") {
  const directories = {};
  const entries = await readdir(directory, { withFileTypes: true });
  const items = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    const info = await stat(file);
    const isDirectory = info.isDirectory();
    const href = `${relative}${encodeURIComponent(entry.name)}${isDirectory ? "/" : ""}`;
    const item = {
      name: entry.name,
      type: isDirectory ? "directory" : "file",
      size: isDirectory ? null : info.size,
      modified: info.mtime.toISOString(),
      href,
    };
    if (!isDirectory) item.sha256 = await hashFile(file);
    items.push(item);
  }
  items.sort((left, right) => left.name.localeCompare(right.name));
  directories[relative] = { path: relative, entries: items, total: items.length };
  for (const item of items.filter((entry) => entry.type === "directory"))
    Object.assign(
      directories,
      await buildIndex(
        path.join(directory, item.name),
        `${relative}${encodeURIComponent(item.name)}/`,
      ),
    );
  return directories;
}

export default function generateFilesModule() {
  return { exists, hashFile, listFiles, buildIndex };
}
