#!/usr/bin/env node
async function discoverLatestNpm(requestedVersion = "latest", fetchImpl = fetch) {
  const metadataUrl = `https://registry.npmjs.org/npm/${encodeURIComponent(requestedVersion)}`;
  const response = await fetchImpl(metadataUrl, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status}`);
  const metadata = await response.json();
  if (requestedVersion !== "latest" && metadata.version !== requestedVersion)
    throw new Error(
      `npm registry returned ${metadata.version} for requested version ${requestedVersion}`,
    );
  const versionMatch = /^(\d+)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(metadata.version || "");
  if (!versionMatch || Number(versionMatch[1]) < 12)
    throw new Error(
      `latest npm version must be 12.0.0 or later, received ${metadata.version || "none"}`,
    );
  const tarball = new URL(metadata.dist?.tarball || "");
  if (tarball.protocol !== "https:" || tarball.hostname !== "registry.npmjs.org")
    throw new Error("npm registry returned an untrusted archive URL");
  if (!/^sha512-[A-Za-z0-9+/]+=*$/.test(metadata.dist?.integrity || ""))
    throw new Error("npm registry did not provide a SHA-512 integrity value");
  return {
    version: metadata.version,
    file: `npm-${metadata.version}.tgz`,
    url: tarball.href,
    integrity: metadata.dist.integrity,
  };
}

export default function moduleApi() {
  return { discoverLatestNpm };
}
