import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const fingerprint = "A".repeat(40);
const verifySignature = jest.fn(async () => fingerprint);
const checksumForFile = jest.fn(() => "b".repeat(64));
const hashFile = jest.fn(async (file) =>
  file === "/archive/node.tar.xz" ? "b".repeat(64) : "npm-hash",
);
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("../../src/prepare/signature.mjs", () => ({ default: verifySignature }));
jest.unstable_mockModule("../../src/prepare/checksum.mjs", () => ({ default: checksumForFile }));
jest.unstable_mockModule("../../src/prepare/hash.mjs", () => ({ default: hashFile }));
const { default: verifyReleaseInput } = await import("../../src/prepare/verification.mjs");

function input(overrides = {}) {
  return {
    keyConfig: { fingerprints: [fingerprint] },
    keyringDir: "/keys",
    signaturePath: "/checksums.sig",
    checksumsPath: "/checksums.txt",
    archivePath: "/archive/node.tar.xz",
    npmArchivePath: "/archive/npm.tgz",
    release: { source: { file: "node.tar.xz" } },
    npmRelease: { file: "npm.tgz", integrity: "sha512-npm-hash" },
    ...overrides,
  };
}

test("verifies source signatures, archive checksums, and npm integrity", async () => {
  await fs.writeFile("/checksums.txt", "checksums");
  await expect(verifyReleaseInput(input())).resolves.toEqual({
    fingerprint,
    archiveSha256: "b".repeat(64),
  });
  expect(verifySignature).toHaveBeenCalledWith("/keys", "/checksums.sig", "/checksums.txt");
  expect(checksumForFile).toHaveBeenCalledWith("checksums", "node.tar.xz");
  expect(hashFile).toHaveBeenNthCalledWith(1, "/archive/node.tar.xz");
  expect(hashFile).toHaveBeenNthCalledWith(2, "/archive/npm.tgz", "sha512", "base64");
});

test("rejects unapproved signing keys and archive checksum mismatches", async () => {
  await expect(
    verifyReleaseInput(input({ keyConfig: { fingerprints: ["C".repeat(40)] } })),
  ).rejects.toThrow(`Node.js checksum signature uses an unapproved key: ${fingerprint}`);

  hashFile.mockResolvedValueOnce("wrong-hash");
  await expect(verifyReleaseInput(input())).rejects.toThrow(
    "archive checksum mismatch for node.tar.xz",
  );
});

test("rejects npm archive integrity mismatches", async () => {
  hashFile.mockResolvedValueOnce("b".repeat(64)).mockResolvedValueOnce("wrong-integrity");
  await expect(verifyReleaseInput(input())).rejects.toThrow(
    "npm archive integrity mismatch for npm.tgz",
  );
});
