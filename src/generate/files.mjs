import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
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

async function hashFile(
  file,
  algorithm = "sha256",
  encoding = "hex",
  createStream = createReadStream,
) {
  const hash = createHash(algorithm);
  for await (const chunk of createStream(file)) hash.update(chunk);
  return hash.digest(encoding);
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

export default function generateFilesModule() {
  return { exists, hashFile, listFiles };
}
