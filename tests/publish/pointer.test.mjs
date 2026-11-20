import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: pointerOperationsModule } = await import("../../src/publish/pointer.mjs");
const { exists, replacePointer } = pointerOperationsModule();

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

test("replaces repository pointers and cleans temporary links after errors", async () => {
  const root = "/virtual/publish-pointer";
  const target = path.join(root, "target");
  const pointer = path.join(root, "metadata/pointer");
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "content"), "new");
  await replacePointer(pointer, target);
  await expect(fs.readFile(path.join(pointer, "content"), "utf8")).resolves.toBe("new");
  const secondTarget = path.join(root, "second-target");
  await fs.mkdir(secondTarget, { recursive: true });
  await fs.writeFile(path.join(secondTarget, "content"), "replacement");
  await replacePointer(pointer, secondTarget);
  await expect(fs.readFile(path.join(pointer, "content"), "utf8")).resolves.toBe("replacement");

  await expect(
    replacePointer(pointer, target, {
      rename: async () => {
        throw Object.assign(new Error("exists"), { code: "EEXIST" });
      },
    }),
  ).rejects.toThrow("cannot atomically replace repository pointer");
  expect((await fs.readdir(root)).sort()).toEqual(["metadata", "second-target", "target"]);
  const denied = {
    rename: async () => {
      throw Object.assign(new Error("denied"), { code: "EACCES" });
    },
  };
  await expect(replacePointer(pointer, target, denied)).rejects.toThrow("denied");
  await fs.rm(pointer, { force: true });
  await expect(replacePointer(pointer, target, denied)).rejects.toThrow("denied");
});
