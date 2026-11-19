import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: publishFilesystemModule } = await import("../../src/publish/filesystem.mjs");
const { exists, replacePointer, atomicCopy, hashFile, writeJson, listFiles } =
  publishFilesystemModule();

test("checks paths and propagates non-missing filesystem errors", async () => {
  const root = "/virtual/publish-fs";
  await fs.mkdir(root, { recursive: true });
  const file = path.join(root, "file");
  await fs.writeFile(file, "data");
  await expect(exists(file)).resolves.toBe(true);
  await expect(exists(path.join(root, "missing"))).resolves.toBe(false);
  const error = Object.assign(new Error("denied"), { code: "EACCES" });
  await expect(
    exists(file, async () => {
      throw error;
    }),
  ).rejects.toBe(error);
});

test("replaces repository pointers and copies files atomically", async () => {
  const root = "/virtual/publish-pointer";
  const target = path.join(root, "target");
  const pointer = path.join(root, "metadata/pointer");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "content"), "new");
  await replacePointer(pointer, target);
  await expect(fs.readFile(path.join(pointer, "content"), "utf8")).resolves.toBe("new");
  await fs.rm(pointer, { recursive: true, force: true });
  await fs.mkdir(pointer);
  await fs.writeFile(path.join(pointer, "old"), "old");
  await replacePointer(pointer, target);
  await expect(fs.readFile(path.join(pointer, "content"), "utf8")).resolves.toBe("new");

  const destination = path.join(root, "copy.json");
  await atomicCopy(path.join(target, "content"), destination);
  await expect(fs.readFile(destination, "utf8")).resolves.toBe("new");
});

test("writes JSON and hashes files", async () => {
  const root = "/virtual/publish-sign";
  await fs.mkdir(root, { recursive: true });
  const file = path.join(root, "metadata.json");
  await writeJson(file, { version: 1 });
  await expect(fs.readFile(file, "utf8")).resolves.toBe('{\n  "version": 1\n}\n');
  await expect(hashFile(file)).resolves.toMatch(/^[a-f\d]{64}$/);
});

test("lists repository files and builds an index with exclusions", async () => {
  const root = "/virtual/publish-index";
  await fs.mkdir(path.join(root, "folder"), { recursive: true });
  await fs.writeFile(path.join(root, "folder", "a file.txt"), "payload");
  await fs.writeFile(path.join(root, "metadata.json"), "{}\n");
  await fs.symlink("metadata.json", path.join(root, "link.json"));
  const files = await listFiles(root);
  expect(files.map(({ path: name }) => name)).toEqual(["folder/a file.txt", "metadata.json"]);
  await fs.rm(path.join(root, "link.json"));
  await expect(listFiles(root, new Set(["metadata.json"]), "")).resolves.toHaveLength(1);
});
