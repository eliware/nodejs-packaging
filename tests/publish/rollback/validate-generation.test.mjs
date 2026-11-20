import { createHash } from "node:crypto";
import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:fs", () => ({ createReadStream: fs.createReadStream }));
const { default: validateGeneration } =
  await import("../../../src/publish/rollback/validate-generation.mjs");

const generation = "node-v26.1.2-el10-x86_64-20261120112233";
const root = `/virtual/rollback/.generations/${generation}`;
const manifestPath = `${root}/metadata/release-manifest.json`;
const catalogPath = `${root}/metadata/catalog.json`;
const repositoryPath = `${root}/el10/x86_64/stable/repodata/repomd.xml`;
const filePath = `${root}/el10/x86_64/stable/node.rpm`;
const hash = "a".repeat(64);

function fixtures(overrides = {}) {
  const active = {
    metadata_version: "0.1.0",
    schema: 1,
    generation,
    generated: "2026-11-20T11:22:33.000Z",
  };
  const manifest = {
    metadata_version: "0.1.0",
    schema: 1,
    generation_id: generation,
    signed: true,
    publication_ready: true,
    catalog_sha256: hash,
    repository_metadata_sha256: hash,
    files: [{ path: "el10/x86_64/stable/node.rpm", sha256: hash, size: 4 }],
    ...overrides,
  };
  const load = jest.fn(async (file) =>
    file.endsWith("active-generation.json") ? JSON.stringify(active) : JSON.stringify(manifest),
  );
  const hashFile = jest.fn(async () => hash);
  const stat = jest.fn(async () => ({ size: 4 }));
  return { load, hashFile, stat };
}

test("validates and resolves a complete retained generation", async () => {
  const dependencies = fixtures();
  await expect(
    validateGeneration("/virtual/rollback", generation, dependencies.load, dependencies),
  ).resolves.toEqual({
    root,
    manifest: manifestPath,
    signature: `${manifestPath}.asc`,
  });
  expect(dependencies.hashFile).toHaveBeenCalledWith(catalogPath);
  expect(dependencies.hashFile).toHaveBeenCalledWith(repositoryPath);
  expect(dependencies.hashFile).toHaveBeenCalledWith(filePath);
});

test("rejects mismatched generation metadata", async () => {
  const dependencies = fixtures();
  dependencies.load.mockImplementation(async (file) =>
    file.endsWith("active-generation.json")
      ? JSON.stringify({ metadata_version: "0.1.0", schema: 1, generation: "another" })
      : JSON.stringify({}),
  );
  await expect(
    validateGeneration("/virtual/rollback", generation, dependencies.load, dependencies),
  ).rejects.toThrow("generation metadata does not match its directory");
});

test("rejects incomplete manifests, unsafe paths, and changed generation files", async () => {
  const incomplete = fixtures({ publication_ready: false });
  await expect(
    validateGeneration("/virtual/rollback", generation, incomplete.load, incomplete),
  ).rejects.toThrow("generation manifest is not publication ready");

  for (const entry of [
    null,
    { path: 4, sha256: hash, size: 4 },
    { path: "", sha256: hash, size: 4 },
    { path: "file.rpm", sha256: 4, size: 4 },
    { path: "file.rpm", sha256: "invalid", size: 4 },
    { path: "file.rpm", sha256: hash, size: "4" },
    { path: "file.rpm", sha256: hash, size: -1 },
    { path: "/outside", sha256: hash, size: 4 },
    { path: "../outside", sha256: hash, size: 4 },
    { path: "..", sha256: hash, size: 4 },
  ]) {
    const unsafe = fixtures({ files: [entry] });
    await expect(
      validateGeneration("/virtual/rollback", generation, unsafe.load, unsafe),
    ).rejects.toThrow("generation manifest contains an invalid file entry");
  }

  const changed = fixtures();
  changed.hashFile.mockImplementation(async (file) => (file === filePath ? "b".repeat(64) : hash));
  await expect(
    validateGeneration("/virtual/rollback", generation, changed.load, changed),
  ).rejects.toThrow("generation file integrity check failed");

  const badMetadata = fixtures({ catalog_sha256: "b".repeat(64) });
  await expect(
    validateGeneration("/virtual/rollback", generation, badMetadata.load, badMetadata),
  ).rejects.toThrow("generation metadata integrity check failed");
});

test("uses filesystem defaults to verify a retained generation", async () => {
  const directory = "/virtual/rollback-defaults";
  const generationRoot = path.join(directory, ".generations", generation);
  const metadataRoot = path.join(generationRoot, "metadata");
  const rpmPath = path.join(generationRoot, "el10/x86_64/stable/node.rpm");
  const repositoryPath = path.join(generationRoot, "el10/x86_64/stable/repodata/repomd.xml");
  const catalogPath = path.join(metadataRoot, "catalog.json");
  const digest = (content) => createHash("sha256").update(content).digest("hex");
  const rpm = "rpm bytes";
  const repository = "repository metadata";
  const catalog = "catalog metadata";
  await fs.mkdir(path.dirname(rpmPath), { recursive: true });
  await fs.mkdir(path.dirname(repositoryPath), { recursive: true });
  await fs.mkdir(metadataRoot, { recursive: true });
  await fs.writeFile(rpmPath, rpm);
  await fs.writeFile(repositoryPath, repository);
  await fs.writeFile(catalogPath, catalog);
  await fs.writeFile(
    path.join(metadataRoot, "active-generation.json"),
    JSON.stringify({ metadata_version: "0.1.0", schema: 1, generation }),
  );
  await fs.writeFile(
    path.join(metadataRoot, "release-manifest.json"),
    JSON.stringify({
      metadata_version: "0.1.0",
      schema: 1,
      generation_id: generation,
      signed: true,
      publication_ready: true,
      catalog_sha256: digest(catalog),
      repository_metadata_sha256: digest(repository),
      files: [
        {
          path: "el10/x86_64/stable/node.rpm",
          sha256: digest(rpm),
          size: Buffer.byteLength(rpm),
        },
      ],
    }),
  );
  await expect(validateGeneration(directory, generation)).resolves.toMatchObject({
    root: generationRoot,
  });
});
