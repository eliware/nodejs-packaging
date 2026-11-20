import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";

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

export default function generateFilesModule() {
  return { exists, hashFile };
}
