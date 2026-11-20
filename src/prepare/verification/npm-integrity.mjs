import hashFile from "../hash.mjs";

export default async function verifyNpmArchiveIntegrity({ npmArchivePath, npmRelease }) {
  const npmArchiveSha512 = await hashFile(npmArchivePath, "sha512", "base64");
  if (`sha512-${npmArchiveSha512}` !== npmRelease.integrity)
    throw new Error(`npm archive integrity mismatch for ${npmRelease.file}`);
}
