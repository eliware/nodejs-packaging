import path from "node:path";
import { fileURLToPath } from "node:url";
import discoverLatestRelease from "./discover/release.mjs";
import discoverLatestNpm from "./discover/npm.mjs";
import releaseSourceModule from "./prepare/release-source.mjs";
const { resolveReleaseVersion } = releaseSourceModule();
import downloadReleaseInputs from "./prepare/download-inputs.mjs";
import loadReleaseKeyConfig from "./prepare/key-config.mjs";
import verifyReleaseInput from "./prepare/verification.mjs";
import resolveSourceDirectory from "./prepare/source-path.mjs";
import writeReleaseRecord from "./prepare/record.mjs";
import prepareReleaseDirectories from "./prepare/directories.mjs";
import loadPrepareArguments from "./prepare/arguments.mjs";
export default async function main(argv = process.argv.slice(2), dependencies = {}) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const keyConfig = await loadReleaseKeyConfig(root);
  const outputRoot = resolveSourceDirectory(root, process.env.NODEJS_SOURCE_DIR);
  const discoverRelease =
    dependencies.discoverLatestRelease || ((version) => discoverLatestRelease(fetch, version));
  const selected = await discoverRelease();
  const { version, allowOlder, npmVersion } = loadPrepareArguments(argv, selected);

  const release = await resolveReleaseVersion(version, selected, allowOlder, discoverRelease);
  const npmRelease = await (dependencies.discoverLatestNpm || discoverLatestNpm)(npmVersion);
  const {
    outputDir,
    archivePath,
    checksumsPath,
    signaturePath,
    npmArchivePath,
    keyringDir,
    keyringPath,
  } = await prepareReleaseDirectories(outputRoot, version, release, npmRelease);
  await downloadReleaseInputs({
    release,
    npmRelease,
    archivePath,
    checksumsPath,
    signaturePath,
    npmArchivePath,
    keyringPath,
  });

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
