import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export default async function writeReleaseRecords({
  candidate,
  root,
  version,
  generationId,
  rpmRecordUpdated,
  sourceInput,
  now,
}) {
  const generated = now.toISOString();
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
    ...(process.env.NODEJS_CONDUCTOR_RUN_ID
      ? { logs_path: `metadata/logs/${process.env.NODEJS_CONDUCTOR_RUN_ID}/` }
      : {}),
    generation_id: generationId,
    generated,
  };
  await mkdir(path.join(candidate, "metadata/provenance"), { recursive: true });
  await writeFile(
    path.join(candidate, "metadata/provenance/package.json"),
    `${JSON.stringify(
      {
        metadata_version: "0.1.0",
        schema: 1,
        generation_id: generationId,
        node_version: version,
        source: sourceInput.source,
        npm: sourceInput.npm,
        package: rpmRecordUpdated,
        validation_path: "metadata/validation/package.json",
        ...(process.env.NODEJS_CONDUCTOR_RUN_ID
          ? { logs_path: `metadata/logs/${process.env.NODEJS_CONDUCTOR_RUN_ID}/` }
          : {}),
        generated,
      },
      null,
      2,
    )}\n`,
  );
  await mkdir(path.join(candidate, "metadata/releases"), { recursive: true });
  await writeFile(
    path.join(candidate, "metadata/releases/nodejs26.json"),
    `${JSON.stringify(releaseRecord, null, 2)}\n`,
  );

  const catalog = JSON.parse(
    await readFile(path.join(root, "templates/catalog.seed.json"), "utf8"),
  );
  catalog.generated = generated;
  catalog.active_generation = generationId;
  catalog.stable = { available: true, latest: releaseRecord, items: [releaseRecord] };
  await mkdir(path.join(candidate, "metadata"), { recursive: true });
  await writeFile(
    path.join(candidate, "metadata/catalog.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
  await writeFile(
    path.join(candidate, "generation.json"),
    `${JSON.stringify({ metadata_version: "0.1.0", schema: 1, generation: generationId, generated }, null, 2)}\n`,
  );
}
