import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import generateFilesModule from "./files.mjs";

const { hashFile } = generateFilesModule();

async function buildIndex(directory, relative = "/", excludedPath = "", relativeFs = "") {
  const items = [];
  const directories = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    const entryPath = relativeFs ? `${relativeFs}/${entry.name}` : entry.name;
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
        relativeFs ? `${relativeFs}/${item.name}` : item.name,
      ),
    );
  return directories;
}

export default function generateIndexModule() {
  return { buildIndex };
}
