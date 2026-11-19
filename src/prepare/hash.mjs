import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

async function hashFile(file, algorithm = "sha256", encoding = "hex", open = createReadStream) {
  const hash = createHash(algorithm);
  for await (const chunk of open(file)) hash.update(chunk);
  return hash.digest(encoding);
}

export default function hashModule() {
  return { hashFile };
}
