import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: imageCatalogModule } = await import("../../../src/publish/image/catalog.mjs");
const { writeImageCatalog } = imageCatalogModule();

test("updates the stable catalog and release record with image metadata", async () => {
  const stage = "/virtual/image-catalog";
  const catalogPath = path.join(stage, "metadata/catalog.json");
  const releasePath = path.join(stage, "metadata/releases/nodejs26.json");
  await fs.mkdir(path.dirname(catalogPath), { recursive: true });
  await fs.mkdir(path.dirname(releasePath), { recursive: true });
  await fs.writeFile(
    catalogPath,
    JSON.stringify({
      stable: { latest: { node_version: "26.13.1" }, items: [{ node_version: "26.13.1" }] },
    }),
  );
  const files = {
    writeJson: async (file, value) => fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`),
  };
  const image = { source_release: "26.13.1", local_image_id: "sha256:local" };
  const imageRecord = { repository: "ghcr.io/example/node", digest: `sha256:${"a".repeat(64)}` };
  const result = await writeImageCatalog({
    stage,
    image,
    imageRecord,
    generationId: "generation-1",
    generated: "2026-11-19T12:00:00.000Z",
    files,
  });
  expect(result).toBe(catalogPath);
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  expect(catalog.stable.latest).toEqual(expect.objectContaining({ image: imageRecord }));
  expect(catalog.images[0]).toEqual(
    expect.objectContaining({
      digest: imageRecord.digest,
      local_image_id: "sha256:local",
      node_version: "26.13.1",
    }),
  );
  expect(JSON.parse(await fs.readFile(releasePath, "utf8"))).toEqual(catalog.stable.latest);
});
