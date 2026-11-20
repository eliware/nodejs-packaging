import validateDownloadUrl from "./download/validate-url.mjs";
import saveDownloadedFile from "./download/file.mjs";

export default async function download(url, destination, trustedHosts, dependencies = {}) {
  const fetchFile = dependencies.fetch || globalThis.fetch;
  validateDownloadUrl(url, trustedHosts);
  const response = await fetchFile(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`download failed with HTTP ${response.status}: ${url}`);
  validateDownloadUrl(response.url || url, trustedHosts);
  await saveDownloadedFile(response.body, destination, dependencies);
}
