import { spawnSync } from "node:child_process";

export default function verifyGenerationSignature(
  signature,
  manifest,
  { gpgHome, keyFingerprint, run = spawnSync },
) {
  if (!/^[A-F0-9]{40}$/.test(keyFingerprint || ""))
    throw new Error("trusted release signing fingerprint is required for rollback");
  const result = run(
    "gpg",
    ["--batch", "--homedir", gpgHome, "--status-fd=1", "--verify", signature, manifest],
    { encoding: "utf8" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `generation signature verification failed: ${result.stderr || "unknown error"}`,
    );
  const validSignature = String(result.stdout || "")
    .split("\n")
    .find((line) => line.startsWith("[GNUPG:] VALIDSIG "));
  const fields = validSignature?.trim().split(/\s+/) || [];
  const signer = fields[2];
  if (signer !== keyFingerprint)
    throw new Error("generation signature was not made by the trusted release signing key");
}
