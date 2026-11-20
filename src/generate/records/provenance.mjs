import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export default async function writeProvenanceRecord({
  candidate,
  generationId,
  version,
  sourceInput,
  rpmRecordUpdated,
  generated,
}) {
  const runId = process.env.NODEJS_CONDUCTOR_RUN_ID;
  const provenance = {
    metadata_version: "0.1.0",
    schema: 1,
    generation_id: generationId,
    node_version: version,
    source: sourceInput.source,
    npm: sourceInput.npm,
    package: rpmRecordUpdated,
    validation_path: "metadata/validation/package.json",
    ...(runId ? { logs_path: `metadata/logs/${runId}/` } : {}),
    generated,
  };
  await mkdir(path.join(candidate, "metadata/provenance"), { recursive: true });
  await writeFile(
    path.join(candidate, "metadata/provenance/package.json"),
    `${JSON.stringify(provenance, null, 2)}\n`,
  );
  return provenance;
}
