import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import generateFilesModule from "./files.mjs";

const { hashFile } = generateFilesModule();

export default async function scanDirectory(directory, relative, excludedPath, relativeFs) {
  const items = [];
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
  return items.sort((left, right) => left.name.localeCompare(right.name));
}
