import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: prepareImageManifest } =
  await import("../../../src/publish/image/manifest-data.mjs");

test("prepares manifest fields and excludes generated manifest files", async () => {
  const stage = "/virtual/image-manifest-data";
  const manifestPath = `${stage}/metadata/release-manifest.json`;
  await fs.mkdir(`${stage}/metadata`, { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify({ signed: false }));
  const files = {
    hashFile: jest.fn(async (file) => (file.endsWith("catalog.json") ? "catalog" : "repo")),
    listFiles: jest.fn(async () => [{ path: "image.json" }]),
  };
  const result = await prepareImageManifest({
    stage,
    generationId: "generation-1",
    generated: "2026-11-20T00:00:00.000Z",
    files,
  });
  expect(result).toEqual({
    manifestPath,
    manifest: {
      signed: false,
      generation_id: "generation-1",
      generated: "2026-11-20T00:00:00.000Z",
      catalog_sha256: "catalog",
      repository_metadata_sha256: "repo",
      files: [{ path: "image.json" }],
    },
  });
  expect(files.listFiles.mock.calls[0][1]).toEqual(
    new Set([
      "metadata/release-manifest.json",
      "metadata/release-manifest.json.asc",
      "metadata/repository-index.json",
    ]),
  );
});
