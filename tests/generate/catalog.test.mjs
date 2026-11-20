import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: writeCatalogMetadata } = await import("../../src/generate/catalog.mjs");

test("writes catalog and generation metadata", async () => {
  const root = "/virtual/catalog";
  const candidate = path.join(root, "candidate");
  const generated = "2026-11-19T12:00:00.000Z";
  const generationId = "node-v26.13.1-el10-x86_64-test";
  const releaseRecord = { release_id: "node-v26.13.1-el10-x86_64" };
  const templateRoot = path.join(root, "templates");
  await fs.mkdir(templateRoot, { recursive: true });
  await fs.writeFile(
    path.join(templateRoot, "catalog.seed.json"),
    JSON.stringify({ metadata_version: "0.1.0", node_major: 26, stable: { items: [] } }),
  );

  await writeCatalogMetadata({ candidate, root, generationId, generated, releaseRecord });

  const catalog = JSON.parse(await fs.readFile(path.join(candidate, "metadata/catalog.json")));
  expect(catalog).toEqual(
    expect.objectContaining({
      generated,
      active_generation: generationId,
      stable: { available: true, latest: releaseRecord, items: [releaseRecord] },
      node_major: 26,
    }),
  );
  const generation = JSON.parse(await fs.readFile(path.join(candidate, "generation.json")));
  expect(generation).toEqual({
    metadata_version: "0.1.0",
    schema: 1,
    generation: generationId,
    generated,
  });
});
