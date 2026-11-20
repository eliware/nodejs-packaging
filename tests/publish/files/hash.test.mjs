import { Readable } from "node:stream";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs", () => ({
  createReadStream: (file) =>
    Readable.from(
      (async function* () {
        yield await fs.readFile(file);
      })(),
    ),
}));
const { default: hashFile } = await import("../../../src/publish/files/hash.mjs");

test("hashes a file with SHA-256", async () => {
  await fs.mkdir("/virtual/publish-hash", { recursive: true });
  await fs.writeFile("/virtual/publish-hash/data", "data");
  await expect(hashFile("/virtual/publish-hash/data")).resolves.toMatch(/^[a-f\d]{64}$/);
});
