import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import discoverReleaseModule from "./discover/release.mjs";
const { discoverLatestRelease } = discoverReleaseModule();
import discoverNpmModule from "./discover/npm.mjs";
const { discoverLatestNpm } = discoverNpmModule();
import releaseSourceModule from "./prepare/release-source.mjs";
const { resolveReleaseVersion, verifySignature, checksumForFile } = releaseSourceModule();
import downloadModule from "./prepare/download.mjs";
import hashModule from "./prepare/hash.mjs";
import prepareRecordModule from "./prepare/record.mjs";
const { download } = downloadModule();
const { hashFile } = hashModule();
const { writeReleaseRecord } = prepareRecordModule();

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
  await download(release.source.url, archivePath, ["nodejs.org", "raw.githubusercontent.com"]);
  await download(release.source.checksums_url, checksumsPath, [
    "nodejs.org",
    "raw.githubusercontent.com",
  ]);
  await download(release.source.signature_url, signaturePath, [
    "nodejs.org",
    "raw.githubusercontent.com",
  ]);
  await download(npmRelease.url, npmArchivePath, ["registry.npmjs.org"]);

  const keyringDir = path.join(outputDir, "keyring");
  await mkdir(keyringDir, { recursive: true, mode: 0o700 });
  await download(
    "https://raw.githubusercontent.com/nodejs/release-keys/main/gpg-only-active-keys/pubring.kbx",
    path.join(keyringDir, "pubring.kbx"),
    ["nodejs.org", "raw.githubusercontent.com"],
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

  const record = await writeReleaseRecord({
    outputDir,
    version,
    release,
    npmRelease,
    fingerprint,
    archiveSha256,
  });
  process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
}

export default function moduleApi() {
  return { main };
}
