import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export default async function writeReleaseRecord({
  candidate,
  generationId,
  version,
  sourceInput,
  rpmRecordUpdated,
  generated,
}) {
  const runId = process.env.NODEJS_CONDUCTOR_RUN_ID;
  const releaseRecord = {
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
    source: sourceInput.source,
    npm: sourceInput.npm,
    package: rpmRecordUpdated,
    validation: { status: "passed", record_path: "metadata/validation/package.json" },
    provenance_path: "metadata/provenance/package.json",
    ...(runId ? { logs_path: `metadata/logs/${runId}/` } : {}),
    generation_id: generationId,
    generated,
  };
  await mkdir(path.join(candidate, "metadata/releases"), { recursive: true });
  await writeFile(
    path.join(candidate, "metadata/releases/nodejs26.json"),
    `${JSON.stringify(releaseRecord, null, 2)}\n`,
  );
  return releaseRecord;
}
