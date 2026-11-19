import { createHash } from "node:crypto";
import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: generateFilesModule } = await import("../../src/generate/files.mjs");
const { exists, hashFile, listFiles, buildIndex } = generateFilesModule();

test("lists files with checksums and builds a recursive repository index", async () => {
  const root = "/virtual/generate-files";
  await fs.mkdir(path.join(root, "folder"), { recursive: true });
  await fs.writeFile(path.join(root, "folder", "a file.txt"), "payload");
  await fs.writeFile(path.join(root, "root.txt"), "root");
  await expect(hashFile(path.join(root, "root.txt"), "sha512", "base64")).resolves.toBe(
    createHash("sha512").update("root").digest("base64"),
  );
  await expect(exists(path.join(root, "root.txt"))).resolves.toBe(true);
  await expect(exists(path.join(root, "missing.txt"))).resolves.toBe(false);
  const denied = Object.assign(new Error("denied"), { code: "EACCES" });
  await expect(
    exists("/virtual/denied", async () => {
      throw denied;
    }),
  ).rejects.toBe(denied);
  await fs.symlink("root.txt", path.join(root, "link.txt"));

  const files = await listFiles(root);
  expect(files.map(({ path: name }) => name)).toEqual(["folder/a file.txt", "root.txt"]);
  expect(files[0]).toEqual({
    path: "folder/a file.txt",
    sha256: "239f59ed55e737c77147cf55ad0c1b030b6d7ee748a7426952f9b852d5a935e5",
    size: 7,
  });
  await fs.rm(path.join(root, "link.txt"));

  const index = await buildIndex(root);
  expect(index["/"].entries).toEqual([
    expect.objectContaining({ name: "folder", type: "directory", href: "/folder/" }),
    expect.objectContaining({
      name: "root.txt",
      type: "file",
      href: "/root.txt",
      sha256: expect.any(String),
    }),
  ]);
  expect(index["/folder/"]).toEqual({
    path: "/folder/",
    entries: [expect.objectContaining({ name: "a file.txt", href: "/folder/a%20file.txt" })],
    total: 1,
  });
});

test("returns an empty list and index for an empty directory", async () => {
  const root = "/virtual/generate-files-empty";
  await fs.mkdir(root, { recursive: true });
  await expect(listFiles(root)).resolves.toEqual([]);
  await expect(buildIndex(root)).resolves.toEqual({ "/": { path: "/", entries: [], total: 0 } });
});
