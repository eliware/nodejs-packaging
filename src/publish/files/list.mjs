import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import hashFile from "./hash.mjs";

export default async function listFiles(directory, exclude = new Set(), relative = "") {
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
