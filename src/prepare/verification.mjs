import verifyNodeSignature from "./verification/signature.mjs";
import verifyNodeArchiveChecksum from "./verification/checksum.mjs";
import verifyNpmArchiveIntegrity from "./verification/npm-integrity.mjs";

export default async function verifyReleaseInput(input) {
  const fingerprint = await verifyNodeSignature(input);
  const archiveSha256 = await verifyNodeArchiveChecksum(input);
  await verifyNpmArchiveIntegrity(input);
  return { fingerprint, archiveSha256 };
}
