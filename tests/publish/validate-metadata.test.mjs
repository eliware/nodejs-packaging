import { expect, jest, test } from "@jest/globals";
import path from "node:path";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const root = "/virtual/published";
const schemaRoot = path.resolve("config/schemas");
await fs.mkdir(root, { recursive: true });
for (const [name, file] of Object.entries({
  catalog: "metadata/catalog.json",
  "repository-index": "metadata/repository-index.json",
  "active-generation": "metadata/active-generation.json",
  generation: "generation.json",
  "release-manifest": "metadata/release-manifest.json",
  "image-record": "metadata/provenance/images/nodejs26-image.json",
})) {
  const schema = `${schemaRoot}/${name}.schema.json`;
  await fs.mkdir(path.dirname(schema), { recursive: true });
  await fs.writeFile(schema, JSON.stringify({ type: "object" }));
  const target = `${root}/${file}`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, "{}");
}
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: moduleApi } = await import("../../src/publish/validate-metadata.mjs");
const { validatePublishedMetadata } = moduleApi();

test("validates the published metadata documents", async () => {
  await expect(validatePublishedMetadata(root)).resolves.toBe(true);
  await fs.rm(`${root}/metadata/provenance/images/nodejs26-image.json`);
  await expect(validatePublishedMetadata(root)).resolves.toBe(true);
  const catalogSchema = `${schemaRoot}/catalog.schema.json`;
  await fs.writeFile(catalogSchema, JSON.stringify({ type: "object", required: ["ready"] }));
  await expect(validatePublishedMetadata(root)).rejects.toThrow("schema validation failed");
  await fs.writeFile(catalogSchema, JSON.stringify({ type: "object" }));
  const originalRead = fs.readFile;
  fs.readFile = async (file, options) => {
    if (String(file).includes("nodejs26-image")) throw new Error("disk failure");
    return originalRead(file, options);
  };
  await expect(validatePublishedMetadata(root, { readFileImpl: fs.readFile })).rejects.toThrow(
    "disk failure",
  );
});
