import { readFile } from "node:fs/promises";
import releaseSourceModule from "./release-source.mjs";
import hashFile from "./hash.mjs";

const { verifySignature, checksumForFile } = releaseSourceModule();

export default async function verifyReleaseInput({
  keyConfig,
  keyringDir,
  signaturePath,
  checksumsPath,
  archivePath,
  npmArchivePath,
  release,
  npmRelease,
}) {
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
  return { fingerprint, archiveSha256 };
}
