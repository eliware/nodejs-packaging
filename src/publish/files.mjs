import { createHash } from "node:crypto";
import { cp, readdir, rename, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";

async function atomicCopy(source, destination) {
  const temporary = `${destination}.tmp-${process.pid}`;
  await cp(source, temporary);
  await rename(temporary, destination);
}

async function hashFile(file, createStream = createReadStream) {
  const hash = createHash("sha256");
  for await (const chunk of createStream(file)) hash.update(chunk);
  return hash.digest("hex");
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

export default function fileOperations() {
  return { atomicCopy, hashFile, listFiles };
}
