import { spawnSync } from "node:child_process";

async function resolveReleaseVersion(
  requestedVersion,
  selected,
  allowOlder,
  discoverLatestRelease,
) {
  if (selected.node_version === requestedVersion || !allowOlder) return selected;
  await discoverLatestRelease();
  const base = `https://nodejs.org/dist/v${requestedVersion}/`;
  return {
    metadata_version: "0.1.0",
    schema: 1,
    node_version: requestedVersion,
    source: {
      file: `node-v${requestedVersion}-linux-x64.tar.xz`,
      url: `${base}node-v${requestedVersion}-linux-x64.tar.xz`,
      checksums_file: "SHASUMS256.txt",
      checksums_url: `${base}SHASUMS256.txt`,
      signature_file: "SHASUMS256.txt.sig",
      signature_url: `${base}SHASUMS256.txt.sig`,
    },
  };
}

function verifySignature(keyringDirPath, signature, content, run = spawnSync) {
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

function checksumForFile(text, fileName) {
  const matches = text
    .split(/\r?\n/)
    .map((line) => /^([a-f\d]{64})\s+\*?(.+)$/.exec(line))
    .filter((match) => match?.[2] === fileName);
  if (matches.length !== 1) throw new Error(`checksum file has no unique entry for ${fileName}`);
  return matches[0][1];
}

export default function releaseSourceModule() {
  return { resolveReleaseVersion, verifySignature, checksumForFile };
}
