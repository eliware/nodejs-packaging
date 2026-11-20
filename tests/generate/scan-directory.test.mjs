import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:fs", () => ({ createReadStream: fs.createReadStream }));
const { default: scanDirectory } = await import("../../src/generate/scan-directory.mjs");

test("scans and sorts one directory while excluding a relative path", async () => {
  const root = "/virtual/scan-directory";
  await fs.mkdir(path.join(root, "folder"), { recursive: true });
  await fs.writeFile(path.join(root, "b.txt"), "b");
  await fs.writeFile(path.join(root, "a.txt"), "a");
  await fs.writeFile(path.join(root, "folder/hidden.txt"), "hidden");
  const items = await scanDirectory(root, "/", "folder/hidden.txt", "");
  expect(items.map(({ name }) => name)).toEqual(["a.txt", "b.txt", "folder"]);
  expect(items[0]).toMatchObject({ type: "file", href: "/a.txt", sha256: expect.any(String) });
  expect(items[2]).toMatchObject({ type: "directory", size: null, href: "/folder/" });
});
