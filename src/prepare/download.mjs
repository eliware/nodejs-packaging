import { createWriteStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { rename, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

export default async function download(url, destination, trustedHosts, dependencies = {}) {
  const fetchFile = dependencies.fetch || globalThis.fetch;
  const writeStream = dependencies.createWriteStream || createWriteStream;
  const pipe = dependencies.pipeline || pipeline;
  const remove = dependencies.rm || rm;
  const move = dependencies.rename || rename;
  const initialUrl = new URL(url);
  if (initialUrl.protocol !== "https:" || !trustedHosts.includes(initialUrl.hostname))
    throw new Error(`download left the trusted HTTPS hosts: ${url}`);
  const response = await fetchFile(url, { signal: AbortSignal.timeout(120_000) });
  const finalUrl = new URL(response.url || url);
  if (!response.ok) throw new Error(`download failed with HTTP ${response.status}: ${url}`);
  if (finalUrl.protocol !== "https:" || !trustedHosts.includes(finalUrl.hostname))
    throw new Error(`download left the trusted HTTPS hosts: ${url}`);
  const temporaryPath = `${destination}.${randomUUID()}.part`;
  try {
    await pipe(response.body, writeStream(temporaryPath, { mode: 0o600 }));
    await move(temporaryPath, destination);
  } finally {
    await remove(temporaryPath, { force: true });
  }
}
