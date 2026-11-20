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
const { default: listFiles } = await import("../../src/generate/list-files.mjs");

test("lists nested files with checksums and ignores symbolic links", async () => {
  const root = "/virtual/generate-list-files";
  await fs.mkdir(path.join(root, "folder"), { recursive: true });
  await fs.writeFile(path.join(root, "folder/a file.txt"), "payload");
  await fs.writeFile(path.join(root, "root.txt"), "root");
  await fs.symlink("root.txt", path.join(root, "link.txt"));
  const files = await listFiles(root);
  expect(files.map(({ path: file }) => file)).toEqual(["folder/a file.txt", "root.txt"]);
  expect(files[0]).toEqual({
    path: "folder/a file.txt",
    sha256: "239f59ed55e737c77147cf55ad0c1b030b6d7ee748a7426952f9b852d5a935e5",
    size: 7,
  });
});

test("returns an empty list for an empty directory", async () => {
  const root = "/virtual/generate-list-files-empty";
  await fs.mkdir(root, { recursive: true });
  await expect(listFiles(root)).resolves.toEqual([]);
});
