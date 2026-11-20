import { readFile } from "node:fs/promises";
import releaseSourceModule from "../release-source.mjs";
import hashFile from "../hash.mjs";

const { checksumForFile } = releaseSourceModule();

export default async function verifyNodeArchiveChecksum({ checksumsPath, archivePath, release }) {
  const checksums = await readFile(checksumsPath, "utf8");
  const checksum = checksumForFile(checksums, release.source.file);
  const archiveSha256 = await hashFile(archivePath);
  if (archiveSha256 !== checksum)
    throw new Error(`archive checksum mismatch for ${release.source.file}`);
  return archiveSha256;
}
