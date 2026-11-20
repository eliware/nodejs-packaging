import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const sign = jest.fn(async () => {});
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("../../src/publish/sign.mjs", () => ({ default: sign }));
const { default: writeReleaseManifest } =
  await import("../../src/publish/write-release-manifest.mjs");

test("writes and signs a publication-ready manifest", async () => {
  const root = "/virtual/release-manifest";
  const manifestPath = path.join(root, "metadata/release-manifest.json");
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify({ signed: false, files: [] }));
  const files = {
    hashFile: jest.fn(async (file) =>
      file.endsWith("catalog.json") ? "catalog-hash" : "repomd-hash",
    ),
    listFiles: jest.fn(async () => [{ path: "package.rpm" }]),
    writeJson: jest.fn(async (file, value) => fs.writeFile(file, JSON.stringify(value))),
  };
  await writeReleaseManifest({
    stagingRoot: root,
    keyFingerprint: "C".repeat(40),
    gpgHome: "/keys",
    files,
  });
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  expect(manifest).toEqual({
    signed: true,
    publication_ready: true,
    catalog_sha256: "catalog-hash",
    repository_metadata_sha256: "repomd-hash",
    files: [{ path: "package.rpm" }],
  });
  expect(files.listFiles).toHaveBeenCalledWith(
    root,
    new Set([
      "metadata/release-manifest.json",
      "metadata/release-manifest.json.asc",
      "metadata/repository-index.json",
    ]),
  );
  expect(sign).toHaveBeenCalledWith(manifestPath, "C".repeat(40), "/keys");
});
