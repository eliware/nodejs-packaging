import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import discoverReleaseModule from "./discover/release.mjs";
const { discoverLatestRelease } = discoverReleaseModule();
import discoverNpmModule from "./discover/npm.mjs";
const { discoverLatestNpm } = discoverNpmModule();
import releaseSourceModule from "./prepare/release-source.mjs";
const { resolveReleaseVersion, verifySignature, checksumForFile } = releaseSourceModule();

async function main(argv = process.argv.slice(2), dependencies = {}) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const keyConfig = JSON.parse(
    await readFile(path.join(root, "build-config/nodejs-release-keys.json"), "utf8"),
  );
  const outputRoot = path.resolve(
    process.env.NODEJS_SOURCE_DIR || path.join(root, ".state/sources"),
  );
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith("--")) args.set(argv[index].slice(2), argv[++index]);
  }

  const discoverRelease = dependencies.discoverLatestRelease || discoverLatestRelease;
  const selected = await discoverRelease();
  const version = args.get("version") || selected.node_version;
  if (!/^26\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))
    throw new Error(`unsupported Node.js 26 version: ${version}`);
  if (version !== selected.node_version && args.get("allow-older") !== "true")
    throw new Error(
      `version ${version} is not the latest stable Node.js 26 release ${selected.node_version}`,
    );

  const release = await resolveReleaseVersion(
    version,
    selected,
    args.get("allow-older") === "true",
    discoverRelease,
  );
  const outputDir = path.join(outputRoot, version);
  await mkdir(outputDir, { recursive: true, mode: 0o700 });

  const archivePath = path.join(outputDir, release.source.file);
  const checksumsPath = path.join(outputDir, release.source.checksums_file);
  const signaturePath = path.join(outputDir, release.source.signature_file);
  const npmRelease = await (dependencies.discoverLatestNpm || discoverLatestNpm)(
    args.get("npm-version") || "latest",
  );
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

  async function hashFile(file, algorithm = "sha256", encoding = "hex") {
    const hash = createHash(algorithm);
    const { createReadStream } = await import("node:fs");
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    return hash.digest(encoding);
  }
}

export default function moduleApi() {
  return { main };
}
