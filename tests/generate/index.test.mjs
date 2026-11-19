import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:fs", () => ({ createReadStream: fs.createReadStream }));
const { default: generateIndexModule } = await import("../../src/generate/index.mjs");
const { buildIndex } = generateIndexModule();

test("builds a sorted recursive index with encoded links and checksums", async () => {
  const root = "/virtual/generate-index";
  await fs.mkdir(path.join(root, "folder"), { recursive: true });
  await fs.writeFile(path.join(root, "folder", "a file.txt"), "payload");
  await fs.writeFile(path.join(root, "root.txt"), "root");
  const index = await buildIndex(root);
  expect(index["/"].entries).toEqual([
    expect.objectContaining({ name: "folder", type: "directory", href: "/folder/" }),
    expect.objectContaining({ name: "root.txt", type: "file", href: "/root.txt" }),
  ]);
  expect(index["/folder/"]).toEqual({
    path: "/folder/",
    entries: [
      expect.objectContaining({
        name: "a file.txt",
        href: "/folder/a%20file.txt",
        sha256: expect.any(String),
      }),
    ],
    total: 1,
  });
});

test("excludes the requested path and indexes empty directories", async () => {
  const root = "/virtual/generate-index-excluded";
  await fs.mkdir(path.join(root, "metadata"), { recursive: true });
  await fs.writeFile(path.join(root, "metadata/repository-index.json"), "index");
  await fs.mkdir(path.join(root, "empty"), { recursive: true });
  const index = await buildIndex(root, "/", "metadata/repository-index.json");
  expect(index["/metadata/"].entries).toEqual([]);
  expect(index["/empty/"]).toEqual({ path: "/empty/", entries: [], total: 0 });
});
