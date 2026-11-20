import releaseSourceModule from "../release-source.mjs";

const { verifySignature } = releaseSourceModule();

export default async function verifyNodeSignature({
  keyConfig,
  keyringDir,
  signaturePath,
  checksumsPath,
}) {
  const fingerprint = await verifySignature(keyringDir, signaturePath, checksumsPath);
  if (!keyConfig.fingerprints.includes(fingerprint))
    throw new Error(`Node.js checksum signature uses an unapproved key: ${fingerprint}`);
  return fingerprint;
}
