import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const buildIndex = jest.fn(async () => ({ "/": { path: "/", entries: [] } }));
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("../../src/generate/index.mjs", () => ({ default: buildIndex }));
const { default: writeRepositoryIndex } = await import("../../src/generate/write-index.mjs");

test("writes the shared repository index document", async () => {
  const directory = "/virtual/generation";
  const generated = "2026-11-20T08:00:00.000Z";
  await fs.mkdir(path.join(directory, "metadata"), { recursive: true });
  const result = await writeRepositoryIndex({
    directory,
    generated,
    excludedPath: "metadata/repository-index.json",
  });
  expect(buildIndex).toHaveBeenCalledWith(directory, "/", "metadata/repository-index.json");
  expect(result).toEqual({
    metadata_version: "0.1.0",
    schema: 1,
    generated,
    directories: { "/": { path: "/", entries: [] } },
  });
  await expect(
    fs.readFile(path.join(directory, "metadata/repository-index.json"), "utf8"),
  ).resolves.toBe(`${JSON.stringify(result, null, 2)}\n`);
});
test("uses root index defaults", async () => {
  buildIndex.mockClear();
  const directory = "/virtual/default-index";
  await fs.mkdir(path.join(directory, "metadata"), { recursive: true });
  await writeRepositoryIndex({ directory, generated: "now" });
  expect(buildIndex).toHaveBeenCalledWith(directory, "/", "");
});
