import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const checksumForFile = jest.fn(() => "node-hash");
const hashFile = jest.fn(async () => "node-hash");
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("../../../src/prepare/checksum.mjs", () => ({
  default: checksumForFile,
}));
jest.unstable_mockModule("../../../src/prepare/hash.mjs", () => ({ default: hashFile }));
const { default: verifyNodeArchiveChecksum } =
  await import("../../../src/prepare/verification/checksum.mjs");

test("checks an archive against the signed checksum file", async () => {
  await fs.writeFile("/checksums.txt", "signed checksums");
  await expect(
    verifyNodeArchiveChecksum({
      checksumsPath: "/checksums.txt",
      archivePath: "/archive/node.tar.xz",
      release: { source: { file: "node.tar.xz" } },
    }),
  ).resolves.toBe("node-hash");
  expect(checksumForFile).toHaveBeenCalledWith("signed checksums", "node.tar.xz");
});

test("rejects an archive that differs from the signed checksum", async () => {
  hashFile.mockResolvedValueOnce("wrong");
  await expect(
    verifyNodeArchiveChecksum({
      checksumsPath: "/checksums.txt",
      archivePath: "/archive/node.tar.xz",
      release: { source: { file: "node.tar.xz" } },
    }),
  ).rejects.toThrow("archive checksum mismatch");
});
