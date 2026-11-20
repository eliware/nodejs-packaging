import { createWriteStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { rename, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

export default async function saveDownloadedFile(body, destination, dependencies = {}) {
  const writeStream = dependencies.createWriteStream || createWriteStream;
  const pipe = dependencies.pipeline || pipeline;
  const remove = dependencies.rm || rm;
  const move = dependencies.rename || rename;
  const temporaryPath = `${destination}.${randomUUID()}.part`;
  try {
    await pipe(body, writeStream(temporaryPath, { mode: 0o600 }));
    await move(temporaryPath, destination);
  } finally {
    await remove(temporaryPath, { force: true });
  }
}
