import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:fs", () => ({ createReadStream: fs.createReadStream }));
const { default: createFileEntry } = await import("../../src/generate/file-entry.mjs");

test("creates file metadata and a hash", async () => {
  await fs.mkdir("/virtual/entries", { recursive: true });
  const file = "/virtual/entries/a file.txt";
  await fs.writeFile(file, "content");
  const entry = await createFileEntry({
    entry: { name: path.basename(file) },
    file,
    relative: "/files/",
    relativeFs: "files",
  });
  expect(entry).toMatchObject({
    name: "a file.txt",
    type: "file",
    size: 7,
    href: "/files/a%20file.txt",
  });
  expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
});

test("creates directory metadata without a file hash", async () => {
  await fs.mkdir("/virtual/entries/subdir", { recursive: true });
  const entry = await createFileEntry({
    entry: { name: "subdir" },
    file: "/virtual/entries/subdir",
    relative: "/files/",
    relativeFs: "files",
  });
  expect(entry).toMatchObject({ type: "directory", size: null, href: "/files/subdir/" });
  expect(entry).not.toHaveProperty("sha256");
});

test("excludes entries by their filesystem-relative path", async () => {
  const entry = await createFileEntry({
    entry: { name: "repository-index.json" },
    file: "/virtual/entries/a file.txt",
    relative: "/metadata/",
    relativeFs: "metadata",
    excludedPath: "metadata/repository-index.json",
  });
  expect(entry).toBeNull();
});
