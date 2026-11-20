import { spawnSync } from "node:child_process";

export default function verifyNodeSignature(keyringDirPath, signature, content, run = spawnSync) {
  const result = run(
    "gpg",
    ["--batch", "--homedir", keyringDirPath, "--status-fd=1", "--verify", signature, content],
    { encoding: "utf8", timeout: 30_000 },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Node.js checksum signature verification failed: ${result.stderr.trim()}`);
  const status = result.stdout.split("\n").find((line) => line.startsWith("[GNUPG:] VALIDSIG "));
  if (!status) throw new Error("GnuPG did not report a valid Node.js checksum signature");
  const fields = status.trim().split(/\s+/);
  return fields.at(-1);
}
