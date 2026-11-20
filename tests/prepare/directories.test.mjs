import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: prepareReleaseDirectories } = await import("../../src/prepare/directories.mjs");

test("creates the source and keyring directories and returns input paths", async () => {
  const paths = await prepareReleaseDirectories(
    "/virtual/sources",
    "26.13.1",
    {
      source: { file: "node.tar.xz", checksums_file: "SHASUMS", signature_file: "SHASUMS.sig" },
    },
    { file: "npm.tgz" },
  );
  expect(paths).toEqual({
    outputDir: "/virtual/sources/26.13.1",
    archivePath: "/virtual/sources/26.13.1/node.tar.xz",
    checksumsPath: "/virtual/sources/26.13.1/SHASUMS",
    signaturePath: "/virtual/sources/26.13.1/SHASUMS.sig",
    npmArchivePath: "/virtual/sources/26.13.1/npm.tgz",
    keyringDir: "/virtual/sources/26.13.1/keyring",
    keyringPath: "/virtual/sources/26.13.1/keyring/pubring.kbx",
  });
  await expect(fs.stat(paths.outputDir)).resolves.toMatchObject({
    isDirectory: expect.any(Function),
  });
  await expect(fs.stat(paths.keyringDir)).resolves.toMatchObject({
    isDirectory: expect.any(Function),
  });
});
