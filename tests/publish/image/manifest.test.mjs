import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const sign = jest.fn(async () => {});
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("../../../src/publish/sign.mjs", () => ({ default: sign }));
const { default: writeImageManifest } = await import("../../../src/publish/image/manifest.mjs");

test("updates and signs the image publication manifest", async () => {
  const stage = "/virtual/image-manifest";
  const manifestPath = path.join(stage, "metadata/release-manifest.json");
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify({ generation_id: "old", files: [] }));
  const files = {
    hashFile: jest.fn(async (file) =>
      file.endsWith("catalog.json") ? "catalog-hash" : "repo-hash",
    ),
    listFiles: jest.fn(async () => [{ path: "image.json" }]),
    writeJson: jest.fn(async (file, value) => fs.writeFile(file, JSON.stringify(value))),
  };
  const generationId = "node-v26.13.1-el10-x86_64-20261120112233";
  const generated = "2026-11-20T11:22:33.000Z";
  await writeImageManifest({
    stage,
    generationId,
    generated,
    keyFingerprint: "A".repeat(40),
    gpgHome: "/keys",
    files,
  });
  expect(JSON.parse(await fs.readFile(manifestPath, "utf8"))).toEqual({
    generation_id: generationId,
    generated,
    catalog_sha256: "catalog-hash",
    repository_metadata_sha256: "repo-hash",
    files: [{ path: "image.json" }],
  });
  expect(sign).toHaveBeenCalledWith(manifestPath, "A".repeat(40), "/keys");
});
