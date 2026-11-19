import { spawnSync as spawnProcessSync } from "node:child_process";

async function sign(file, fingerprint, home, spawnSync = spawnProcessSync) {
  const result = spawnSync(
    "gpg",
    ["--batch", "--yes", "--local-user", fingerprint, "--armor", "--detach-sign", file],
    { encoding: "utf8", env: { ...process.env, GNUPGHOME: home } },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`gpg exited with status ${result.status}: ${result.stderr}`);
}

export default function signModule() {
  return { sign };
}
