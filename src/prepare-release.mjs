import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import discoverLatestRelease from "./discover/release.mjs";
import discoverLatestNpm from "./discover/npm.mjs";
import releaseSourceModule from "./prepare/release-source.mjs";
const { resolveReleaseVersion } = releaseSourceModule();
import download from "./prepare/download.mjs";
import verifyReleaseInput from "./prepare/verification.mjs";
import resolveSourceDirectory from "./prepare/source-path.mjs";
import writeReleaseRecord from "./prepare/record.mjs";
import prepareReleaseDirectories from "./prepare/directories.mjs";
export default async function main(argv = process.argv.slice(2), dependencies = {}) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const keyConfig = JSON.parse(
    await readFile(path.join(root, "build-config/nodejs-release-keys.json"), "utf8"),
  );
  const outputRoot = resolveSourceDirectory(root, process.env.NODEJS_SOURCE_DIR);
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith("--")) args.set(argv[index].slice(2), argv[++index]);
  }

  const discoverRelease =
    dependencies.discoverLatestRelease || ((version) => discoverLatestRelease(fetch, version));
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
  const npmRelease = await (dependencies.discoverLatestNpm || discoverLatestNpm)(
    args.get("npm-version") || "latest",
  );
  const {
    outputDir,
    archivePath,
    checksumsPath,
    signaturePath,
    npmArchivePath,
    keyringDir,
    keyringPath,
  } = await prepareReleaseDirectories(outputRoot, version, release, npmRelease);
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

  await download(
    "https://raw.githubusercontent.com/nodejs/release-keys/main/gpg-only-active-keys/pubring.kbx",
    keyringPath,
    ["nodejs.org", "raw.githubusercontent.com"],
  );
  const { fingerprint, archiveSha256 } = await verifyReleaseInput({
    keyConfig,
    keyringDir,
    signaturePath,
    checksumsPath,
    archivePath,
    npmArchivePath,
    release,
    npmRelease,
  });

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
