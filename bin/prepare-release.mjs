#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverLatestRelease } from "./discover-release.mjs";
import { discoverLatestNpm } from "./discover-npm.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keyConfig = JSON.parse(
  await readFile(path.join(root, "build-config/nodejs-release-keys.json"), "utf8"),
);
const outputRoot = path.resolve(process.env.NODEJS_SOURCE_DIR || path.join(root, ".state/sources"));
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  if (process.argv[index].startsWith("--"))
    args.set(process.argv[index].slice(2), process.argv[++index]);
}

const selected = await discoverLatestRelease();
const version = args.get("version") || selected.node_version;
if (!/^26\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))
  throw new Error(`unsupported Node.js 26 version: ${version}`);
if (version !== selected.node_version && args.get("allow-older") !== "true")
  throw new Error(
    `version ${version} is not the latest stable Node.js 26 release ${selected.node_version}`,
  );

const release = await discoverVersion(version);
const outputDir = path.join(outputRoot, version);
await mkdir(outputDir, { recursive: true, mode: 0o700 });

const archivePath = path.join(outputDir, release.source.file);
const checksumsPath = path.join(outputDir, release.source.checksums_file);
const signaturePath = path.join(outputDir, release.source.signature_file);
const npmRelease = await discoverLatestNpm(args.get("npm-version") || "latest");
const npmArchivePath = path.join(outputDir, npmRelease.file);
await download(release.source.url, archivePath);
await download(release.source.checksums_url, checksumsPath);
await download(release.source.signature_url, signaturePath);
await downloadFrom(npmRelease.url, npmArchivePath, ["registry.npmjs.org"]);

const keyringDir = path.join(outputDir, "keyring");
await mkdir(keyringDir, { recursive: true, mode: 0o700 });
await download(
  "https://raw.githubusercontent.com/nodejs/release-keys/main/gpg-only-active-keys/pubring.kbx",
  path.join(keyringDir, "pubring.kbx"),
);
const fingerprint = await verifySignature(keyringDir, signaturePath, checksumsPath);
if (!keyConfig.fingerprints.includes(fingerprint))
  throw new Error(`Node.js checksum signature uses an unapproved key: ${fingerprint}`);

const checksums = await readFile(checksumsPath, "utf8");
const checksum = checksumForFile(checksums, release.source.file);
const archiveSha256 = await hashFile(archivePath);
if (archiveSha256 !== checksum)
  throw new Error(`archive checksum mismatch for ${release.source.file}`);
const npmArchiveSha512 = await hashFile(npmArchivePath, "sha512", "base64");
if (`sha512-${npmArchiveSha512}` !== npmRelease.integrity)
  throw new Error(`npm archive integrity mismatch for ${npmRelease.file}`);

const record = {
  metadata_version: "0.1.0",
  schema: 1,
  release_id: `node-v${version}-el10-x86_64`,
  channel: "stable",
  node_version: version,
  target: {
    distribution: "centos-stream",
    version: "10",
    repository: "epel",
    architecture: "x86_64",
    format: "rpm",
  },
  source: {
    url: release.source.url,
    file: release.source.file,
    sha256: archiveSha256,
    signature_url: release.source.signature_url,
    signing_key_fingerprint: fingerprint,
    verified_at: new Date().toISOString(),
  },
  npm: {
    version: npmRelease.version,
    file: npmRelease.file,
    url: npmRelease.url,
    integrity: npmRelease.integrity,
  },
  prepared_at: new Date().toISOString(),
};
await writeFile(
  path.join(outputDir, "release-input.json"),
  `${JSON.stringify(record, null, 2)}\n`,
  { mode: 0o600 },
);
process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);

async function discoverVersion(requestedVersion) {
  const result = await discoverLatestRelease();
  if (result.node_version === requestedVersion) return result;
  if (args.get("allow-older") !== "true") return result;
  const base = `https://nodejs.org/dist/v${requestedVersion}/`;
  return {
    metadata_version: "0.1.0",
    schema: 1,
    node_version: requestedVersion,
    source: {
      file: `node-v${requestedVersion}-linux-x64.tar.xz`,
      url: `${base}node-v${requestedVersion}-linux-x64.tar.xz`,
      checksums_file: "SHASUMS256.txt",
      checksums_url: `${base}SHASUMS256.txt`,
      signature_file: "SHASUMS256.txt.sig",
      signature_url: `${base}SHASUMS256.txt.sig`,
    },
  };
}

async function download(url, destination) {
  return downloadFrom(url, destination, ["nodejs.org", "raw.githubusercontent.com"]);
}

async function downloadFrom(url, destination, trustedHosts) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  const finalUrl = new URL(response.url || url);
  if (!response.ok) throw new Error(`download failed with HTTP ${response.status}: ${url}`);
  if (finalUrl.protocol !== "https:" || !trustedHosts.includes(finalUrl.hostname))
    throw new Error(`download left the trusted HTTPS hosts: ${url}`);
  const temporaryPath = `${destination}.part`;
  await rm(temporaryPath, { force: true });
  await pipeline(response.body, createWriteStream(temporaryPath, { mode: 0o600 }));
  await rename(temporaryPath, destination);
}

function verifySignature(keyringDirPath, signature, content) {
  const result = spawnSync(
    "gpg",
    ["--batch", "--homedir", keyringDirPath, "--status-fd=1", "--verify", signature, content],
    { encoding: "utf8", timeout: 30_000 },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Node.js checksum signature verification failed: ${result.stderr.trim()}`);
  const status = result.stdout.split("\n").find((line) => line.startsWith("[GNUPG:] VALIDSIG "));
  if (!status) throw new Error("GnuPG did not report a valid Node.js checksum signature");
  const fields = status.trim().split(/\s+/);
  return fields[11] || fields[2];
}

function checksumForFile(text, fileName) {
  const matches = text
    .split(/\r?\n/)
    .map((line) => /^([a-f\d]{64})\s+\*?(.+)$/.exec(line))
    .filter((match) => match?.[2] === fileName);
  if (matches.length !== 1) throw new Error(`checksum file has no unique entry for ${fileName}`);
  return matches[0][1];
}

async function hashFile(file, algorithm = "sha256", encoding = "hex") {
  const hash = createHash(algorithm);
  const { createReadStream } = await import("node:fs");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest(encoding);
}
