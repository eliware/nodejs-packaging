import { spawnSync } from "node:child_process";

export default function verifyGenerationSignature(signature, manifest, verify = spawnSync) {
  const result = verify("gpg", ["--verify", signature, manifest], { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `generation signature verification failed: ${result.stderr || "unknown error"}`,
    );
}
