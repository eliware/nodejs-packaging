import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import generateFilesModule from "./files.mjs";

const { hashFile } = generateFilesModule();

export default async function listFiles(directory, relative = "") {
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
