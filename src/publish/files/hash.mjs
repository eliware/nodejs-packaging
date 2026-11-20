import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export default async function hashFile(file, createStream = createReadStream) {
  const hash = createHash("sha256");
  for await (const chunk of createStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
