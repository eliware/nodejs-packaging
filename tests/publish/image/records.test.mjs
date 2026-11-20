import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const sign = jest.fn(async () => {});
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("../../../src/publish/sign.mjs", () => ({ default: sign }));
const { default: writeImageRecords } = await import("../../../src/publish/image/records.mjs");

test("adds image validation, metadata, and signed provenance records", async () => {
  const root = "/virtual/image-records";
  const stage = path.join(root, "stage");
  const catalogPath = path.join(stage, "metadata/catalog.json");
  const packageProvenancePath = path.join(stage, "metadata/provenance/package.json");
  const writeJson = jest.fn(async (file, value) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
  });
  const files = { writeJson };
  const image = {
    repository: "ghcr.io/eliware/centos10-node26",
    tag: "26.13.1",
    digest: `sha256:${"a".repeat(64)}`,
    base_image: "quay.io/centos/centos:stream10",
    base_image_digest: `quay.io/centos/centos@sha256:${"b".repeat(64)}`,
    rpm_sha256: "c".repeat(64),
    source_release: "26.13.1",
    source_sha256: "d".repeat(64),
    local_image_id: "sha256:local",
  };
  const generated = "2026-11-19T12:00:00.000Z";
  await fs.mkdir(path.dirname(catalogPath), { recursive: true });
  await fs.mkdir(path.dirname(packageProvenancePath), { recursive: true });
  await fs.writeFile(
    catalogPath,
    JSON.stringify({
      stable: {
        latest: { node_version: "26.13.1" },
        items: [{ node_version: "26.13.1" }],
      },
    }),
  );
  await fs.writeFile(packageProvenancePath, JSON.stringify({ node_version: "26.13.1" }));
  const result = await writeImageRecords({
    stage,
    image,
    generationId: "generation-1",
    generated,
    keyFingerprint: "F".repeat(40),
    gpgHome: "/keys",
    files,
  });
  expect(result.catalogPath).toBe(catalogPath);
  expect(result.imageRecord).toEqual(
    expect.objectContaining({ digest: image.digest, validation: "passed" }),
  );
  expect(JSON.parse(await fs.readFile(catalogPath, "utf8")).stable.latest.image).toEqual(
    result.imageRecord,
  );
  expect(
    JSON.parse(await fs.readFile(path.join(stage, "metadata/validation/image.json"), "utf8")),
  ).toEqual(
    expect.objectContaining({ smoke_test: "passed", registry_push: "passed", status: "passed" }),
  );
  expect(
    JSON.parse(
      await fs.readFile(
        path.join(stage, "metadata/provenance/images/nodejs26-26.13.1.json"),
        "utf8",
      ),
    ),
  ).toEqual(
    expect.objectContaining({ image: result.imageRecord, source_sha256: image.source_sha256 }),
  );
  expect(sign).toHaveBeenCalledTimes(2);
});
