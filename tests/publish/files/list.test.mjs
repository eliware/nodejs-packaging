import path from "node:path";
import { Readable } from "node:stream";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

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
const { default: listFiles } = await import("../../../src/publish/files/list.mjs");

test("lists nested regular files and applies exclusions", async () => {
  const root = "/virtual/publish-list";
  await fs.mkdir(path.join(root, "folder"), { recursive: true });
  await fs.writeFile(path.join(root, "folder/file.txt"), "payload");
  await fs.writeFile(path.join(root, "metadata.json"), "{}");
  await fs.symlink("metadata.json", path.join(root, "link.json"));
  await expect(listFiles(root)).resolves.toHaveLength(2);
  await expect(listFiles(root, new Set(["metadata.json"]))).resolves.toHaveLength(1);
  await expect(listFiles(path.join(root, "empty"))).rejects.toMatchObject({ code: "ENOENT" });
});
