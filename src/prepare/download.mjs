import { createWriteStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { rename, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import validateDownloadUrl from "./download/validate-url.mjs";

export default async function download(url, destination, trustedHosts, dependencies = {}) {
  const fetchFile = dependencies.fetch || globalThis.fetch;
  const writeStream = dependencies.createWriteStream || createWriteStream;
  const pipe = dependencies.pipeline || pipeline;
  const remove = dependencies.rm || rm;
  const move = dependencies.rename || rename;
  validateDownloadUrl(url, trustedHosts);
  const response = await fetchFile(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`download failed with HTTP ${response.status}: ${url}`);
  validateDownloadUrl(response.url || url, trustedHosts);
  const temporaryPath = `${destination}.${randomUUID()}.part`;
  try {
    await pipe(response.body, writeStream(temporaryPath, { mode: 0o600 }));
    await move(temporaryPath, destination);
  } finally {
    await remove(temporaryPath, { force: true });
  }
}
