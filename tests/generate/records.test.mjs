import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import Ajv2020 from "ajv/dist/2020.js";
import releaseRecordSchema from "../../config/release-record.schema.json" with { type: "json" };
import imageRecordSchema from "../../config/schemas/image-record.schema.json" with { type: "json" };
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: writeReleaseRecords } = await import("../../src/generate/records.mjs");

test("writes release, validation, and provenance records", async () => {
  const root = "/virtual/records";
  const candidate = path.join(root, "candidate");
  const templateRoot = path.join(root, "templates");
  await fs.mkdir(templateRoot, { recursive: true });
  await fs.writeFile(
    path.join(templateRoot, "catalog.seed.json"),
    JSON.stringify({ metadata_version: "0.1.0", node_major: 26, stable: { items: [] } }),
  );
  const generated = new Date("2026-11-19T12:00:00.000Z");
  const sourceInput = {
    source: {
      url: "https://nodejs.org/archive",
      file: "node-v26.13.1-linux-x64.tar.xz",
      sha256: "b".repeat(64),
      signature_url: "https://nodejs.org/SHASUMS.sig",
      signing_key_fingerprint: "A".repeat(40),
      verified_at: "2026-11-19T12:00:00.000Z",
    },
    npm: {
      version: "12.2.3",
      file: "npm-12.2.3.tgz",
      url: "https://registry.npmjs.org/npm.tgz",
      integrity: `sha512-${"a".repeat(64)}`,
    },
  };
  const rpmRecordUpdated = {
    name: "eliware-node26",
    version: "26.13.1",
    epoch: null,
    release: "1.npm12.2.3.el10",
    architecture: "x86_64",
    npm_version: "12.2.3",
    path: "el10/x86_64/stable/node.rpm",
    sha256: "c".repeat(64),
    size: 123,
  };
  const oldRunId = process.env.NODEJS_CONDUCTOR_RUN_ID;
  process.env.NODEJS_CONDUCTOR_RUN_ID = "run-7";
  await writeReleaseRecords({
    candidate,
    root,
    version: "26.13.1",
    generationId: "node-v26.13.1-el10-x86_64-20261119120000",
    rpmRecordUpdated,
    sourceInput,
    now: generated,
  });

  const release = JSON.parse(
    await fs.readFile(path.join(candidate, "metadata/releases/nodejs26.json")),
  );
  expect(release).toEqual(
    expect.objectContaining({
      logs_path: "metadata/logs/run-7/",
      channel: "stable",
      node_version: "26.13.1",
      generation_id: "node-v26.13.1-el10-x86_64-20261119120000",
      package: rpmRecordUpdated,
      source: sourceInput.source,
      npm: sourceInput.npm,
    }),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  ajv.addSchema(imageRecordSchema);
  const validateRelease = ajv.compile(releaseRecordSchema);
  expect(validateRelease(release)).toBe(true);
  const releaseWithImage = {
    ...release,
    image: {
      repository: "ghcr.io/eliware/centos10-node26",
      tag: "26.13.1",
      digest: `sha256:${"d".repeat(64)}`,
      base_image: "quay.io/centos/centos:stream10",
      base_image_digest: `quay.io/centos/centos@sha256:${"e".repeat(64)}`,
      rpm_sha256: "c".repeat(64),
      validation: "passed",
      provenance_path: "metadata/provenance/images/nodejs26-26.13.1.json",
      logs_path: "metadata/logs/run-7/",
    },
  };
  expect(validateRelease(releaseWithImage)).toBe(true);

  const validation = JSON.parse(
    await fs.readFile(path.join(candidate, "metadata/validation/package.json")),
  );
  expect(validation.checks).toEqual(
    expect.objectContaining({ archive_signature: "passed", npm_version: "12.2.3" }),
  );
  const provenance = JSON.parse(
    await fs.readFile(path.join(candidate, "metadata/provenance/package.json")),
  );
  expect(provenance).toEqual(
    expect.objectContaining({ package: rpmRecordUpdated, logs_path: "metadata/logs/run-7/" }),
  );
  if (oldRunId === undefined) delete process.env.NODEJS_CONDUCTOR_RUN_ID;
  else process.env.NODEJS_CONDUCTOR_RUN_ID = oldRunId;
});
