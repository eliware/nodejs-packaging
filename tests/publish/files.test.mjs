import path from "node:path";
import { Readable } from "node:stream";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:fs", () => ({
  createReadStream: (file) =>
    Readable.from(
      (async function* () {
        yield await fs.readFile(file);
      })(),
    ),
}));
const { default: fileOperations } = await import("../../src/publish/files.mjs");
const { atomicCopy, hashFile, listFiles } = fileOperations();

test("copies files atomically and hashes file contents", async () => {
  const root = "/virtual/publish-files";
  await fs.mkdir(root, { recursive: true });
  const source = path.join(root, "source.json");
  const destination = path.join(root, "copy.json");
  await fs.writeFile(source, "data");
  await atomicCopy(source, destination);
  await expect(fs.readFile(destination, "utf8")).resolves.toBe("data");
  await expect(hashFile(destination)).resolves.toMatch(/^[a-f\d]{64}$/);
});

test("lists nested files with exclusions and ignores links", async () => {
  const root = "/virtual/publish-index";
  await fs.mkdir(path.join(root, "folder"), { recursive: true });
  await fs.writeFile(path.join(root, "folder/a file.txt"), "payload");
  await fs.writeFile(path.join(root, "metadata.json"), "{}\n");
  await fs.symlink("metadata.json", path.join(root, "link.json"));
  const files = await listFiles(root);
  expect(files.map(({ path: name }) => name)).toEqual(["folder/a file.txt", "metadata.json"]);
  await expect(listFiles(root, new Set(["metadata.json"]))).resolves.toHaveLength(1);
});
