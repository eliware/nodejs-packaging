import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const defaultSpawn = jest.fn(() => ({ status: 0, stdout: "", stderr: "" }));
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:child_process", () => ({ spawnSync: defaultSpawn }));
const { default: publishFilesystemModule } = await import("../../src/publish/filesystem.mjs");
const { exists, replacePointer, atomicCopy, hashFile, writeJson, sign, listFiles, buildIndex } =
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

test("writes JSON, hashes files, and signs with GnuPG", async () => {
  const root = "/virtual/publish-sign";
  await fs.mkdir(root, { recursive: true });
  const file = path.join(root, "metadata.json");
  await writeJson(file, { version: 1 });
  await expect(fs.readFile(file, "utf8")).resolves.toBe('{\n  "version": 1\n}\n');
  await expect(hashFile(file)).resolves.toMatch(/^[a-f\d]{64}$/);
  const spawn = jest.fn(() => ({ status: 0, stdout: "", stderr: "" }));
  await expect(sign(file, "F".repeat(40), root, spawn)).resolves.toBeUndefined();
  expect(spawn).toHaveBeenCalledWith(
    "gpg",
    expect.arrayContaining(["--detach-sign", file]),
    expect.objectContaining({ env: expect.objectContaining({ GNUPGHOME: root }) }),
  );
  const failure = new Error("spawn failed");
  await expect(sign(file, "F".repeat(40), root, () => ({ error: failure }))).rejects.toBe(failure);
  await expect(
    sign(file, "F".repeat(40), root, () => ({ status: 2, stderr: "bad key" })),
  ).rejects.toThrow("gpg exited with status 2: bad key");
  await expect(sign(file, "F".repeat(40), root)).resolves.toBeUndefined();
  expect(defaultSpawn).toHaveBeenCalled();
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
  const index = await buildIndex(root, "/", "metadata.json");
  expect(index["/"].entries).toEqual([
    expect.objectContaining({ name: "folder", type: "directory" }),
  ]);
  expect(index["/folder/"]).toEqual({
    path: "/folder/",
    entries: [expect.objectContaining({ name: "a file.txt", href: "/folder/a%20file.txt" })],
    total: 1,
  });
  expect((await buildIndex(root))["/"].entries).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: "metadata.json", type: "file" })]),
  );
});
