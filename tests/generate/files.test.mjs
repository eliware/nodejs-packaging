import { createHash } from "node:crypto";
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
        const contents = await fs.readFile(file);
        yield contents.subarray(0, 2);
        yield contents.subarray(2);
      })(),
    ),
}));
const { default: generateFilesModule } = await import("../../src/generate/files.mjs");
const { exists, hashFile } = generateFilesModule();

test("checks paths and hashes files with selected algorithms", async () => {
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
});
