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
})) {
  const schema = `${schemaRoot}/${name}.schema.json`;
  await fs.mkdir(path.dirname(schema), { recursive: true });
  await fs.writeFile(schema, JSON.stringify({ type: "object" }));
  const target = `${root}/${file}`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  const value = name === "catalog" ? { stable: { latest: { image: { repository: "repo" } } } } : {};
  await fs.writeFile(target, JSON.stringify(value));
}
await fs.writeFile(`${schemaRoot}/image-record.schema.json`, JSON.stringify({ type: "object" }));
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: validatePublishedMetadata } =
  await import("../../src/publish/validate-metadata.mjs");

test("validates catalogs with or without image evidence and rejects invalid documents", async () => {
  await expect(validatePublishedMetadata(root)).resolves.toBe(true);
  await fs.writeFile(`${root}/metadata/catalog.json`, "{}");
  await expect(validatePublishedMetadata(root)).resolves.toBe(true);
  await fs.writeFile(
    `${root}/metadata/catalog.json`,
    JSON.stringify({ stable: { latest: { image: {} } } }),
  );
  await fs.writeFile(
    `${schemaRoot}/image-record.schema.json`,
    JSON.stringify({ type: "object", required: ["ready"] }),
  );
  await expect(validatePublishedMetadata(root)).rejects.toThrow("schema validation failed");
  await fs.writeFile(`${schemaRoot}/image-record.schema.json`, JSON.stringify({ type: "object" }));
  await fs.writeFile(
    `${schemaRoot}/catalog.schema.json`,
    JSON.stringify({ type: "object", required: ["ready"] }),
  );
  await expect(validatePublishedMetadata(root)).rejects.toThrow("schema validation failed");
});
