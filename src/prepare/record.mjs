import { writeFile as writeFileDefault } from "node:fs/promises";
import path from "node:path";

async function writeReleaseRecord({
  outputDir,
  version,
  release,
  npmRelease,
  fingerprint,
  archiveSha256,
  now = new Date(),
  writeFile = writeFileDefault,
}) {
  const record = {
    metadata_version: "0.1.0",
    schema: 1,
    release_id: `node-v${version}-el10-x86_64`,
    channel: "stable",
    node_version: version,
    target: {
      distribution: "centos-stream",
      version: "10",
      repository: "epel",
      architecture: "x86_64",
      format: "rpm",
    },
    source: {
      url: release.source.url,
      file: release.source.file,
      sha256: archiveSha256,
      signature_url: release.source.signature_url,
      signing_key_fingerprint: fingerprint,
      verified_at: now.toISOString(),
    },
    npm: {
      version: npmRelease.version,
      file: npmRelease.file,
      url: npmRelease.url,
      integrity: npmRelease.integrity,
    },
    prepared_at: now.toISOString(),
  };
  await writeFile(
    path.join(outputDir, "release-input.json"),
    `${JSON.stringify(record, null, 2)}\n`,
    { mode: 0o600 },
  );
  return record;
}

export default function prepareRecordModule() {
  return { writeReleaseRecord };
}
