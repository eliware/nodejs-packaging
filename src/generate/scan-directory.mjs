import { readdir } from "node:fs/promises";
import path from "node:path";
import createFileEntry from "./file-entry.mjs";

export default async function scanDirectory(directory, relative, excludedPath, relativeFs) {
  const items = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    const item = await createFileEntry({ entry, file, relative, relativeFs, excludedPath });
    if (item) items.push(item);
  }
  return items.sort((left, right) => left.name.localeCompare(right.name));
}
