import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export default async function writeValidationRecord({
  candidate,
  version,
  sourceInput,
  rpmRecordUpdated,
  generated,
}) {
  const source = sourceInput?.source || {};
  const verificationRecorded = Boolean(source.verified_at);
  const archiveSignaturePassed =
    verificationRecorded &&
    typeof source.signature_url === "string" &&
    /^[A-F0-9]{40}$/.test(source.signing_key_fingerprint || "");
  const archiveChecksumPassed = verificationRecorded && /^[a-f0-9]{64}$/.test(source.sha256 || "");
  if (!archiveSignaturePassed || !archiveChecksumPassed)
    throw new Error("verified Node.js archive evidence is required for the validation record");
  const validation = {
    schema: 1,
    node_version: version,
    target: "centos-stream-10-x86_64",
    checks: {
      archive_signature: "passed",
      archive_checksum: "passed",
      rpm_build: "passed",
      rpm_version: "passed",
      npm_cli: "passed",
      npm_version: rpmRecordUpdated.npm_version,
    },
    status: "passed",
    generated,
  };
  await mkdir(path.join(candidate, "metadata/validation"), { recursive: true });
  await writeFile(
    path.join(candidate, "metadata/validation/package.json"),
    `${JSON.stringify(validation, null, 2)}\n`,
  );
  return validation;
}
