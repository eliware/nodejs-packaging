import { expect, jest, test } from "@jest/globals";
import path from "node:path";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: prepareReleaseDirectories } = await import("../../src/prepare/directories.mjs");

test("creates the source and keyring directories and returns input paths", async () => {
  const root = path.resolve("/virtual/sources");
  const outputDir = path.join(root, "26.13.1");
  const paths = await prepareReleaseDirectories(
    root,
    "26.13.1",
    {
      source: { file: "node.tar.xz", checksums_file: "SHASUMS", signature_file: "SHASUMS.sig" },
    },
    { file: "npm.tgz" },
  );
  expect(paths).toEqual({
    outputDir,
    archivePath: path.join(outputDir, "node.tar.xz"),
    checksumsPath: path.join(outputDir, "SHASUMS"),
    signaturePath: path.join(outputDir, "SHASUMS.sig"),
    npmArchivePath: path.join(outputDir, "npm.tgz"),
    keyringDir: path.join(outputDir, "keyring"),
    keyringPath: path.join(outputDir, "keyring/pubring.kbx"),
  });
  await expect(fs.stat(paths.outputDir)).resolves.toMatchObject({
    isDirectory: expect.any(Function),
  });
  await expect(fs.stat(paths.keyringDir)).resolves.toMatchObject({
    isDirectory: expect.any(Function),
  });
});
