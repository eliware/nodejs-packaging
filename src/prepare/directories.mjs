import { mkdir } from "node:fs/promises";
import path from "node:path";

async function prepareReleaseDirectories(outputRoot, version, release, npmRelease) {
  const outputDir = path.join(outputRoot, version);
  const keyringDir = path.join(outputDir, "keyring");
  await mkdir(outputDir, { recursive: true, mode: 0o700 });
  await mkdir(keyringDir, { recursive: true, mode: 0o700 });
  return {
    outputDir,
    archivePath: path.join(outputDir, release.source.file),
    checksumsPath: path.join(outputDir, release.source.checksums_file),
    signaturePath: path.join(outputDir, release.source.signature_file),
    npmArchivePath: path.join(outputDir, npmRelease.file),
    keyringDir,
    keyringPath: path.join(keyringDir, "pubring.kbx"),
  };
}

export default function prepareDirectoriesModule() {
  return { prepareReleaseDirectories };
}
