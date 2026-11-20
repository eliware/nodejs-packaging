import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: assertSafeRepositoryPaths } =
  await import("../../../src/publish/release/paths.mjs");

test("allows missing, empty, and non-directory public paths", async () => {
  const root = "/virtual/release-paths-safe";
  await assertSafeRepositoryPaths(root);
  await fs.mkdir(path.join(root, "el10/x86_64/stable"), { recursive: true });
  await fs.mkdir(path.join(root, "metadata/provenance"), { recursive: true });
  await assertSafeRepositoryPaths(root);
  await fs.rm(path.join(root, "el10"), { recursive: true, force: true });
  await fs.rm(path.join(root, "metadata"), { recursive: true, force: true });
  await fs.writeFile(path.join(root, "el10"), "file");
  await fs.mkdir(path.join(root, "metadata"), { recursive: true });
  await fs.writeFile(path.join(root, "metadata/releases"), "file");
  await assertSafeRepositoryPaths(root);
});

test("rejects populated stable and metadata directories", async () => {
  const root = "/virtual/release-paths-populated";
  const stable = path.join(root, "el10/x86_64/stable");
  await fs.mkdir(stable, { recursive: true });
  await fs.writeFile(path.join(stable, "node.rpm"), "rpm");
  await expect(assertSafeRepositoryPaths(root)).rejects.toThrow(
    "stable repository path is not empty",
  );

  await fs.rm(path.join(root, "el10"), { recursive: true, force: true });
  const metadata = path.join(root, "metadata/releases");
  await fs.mkdir(metadata, { recursive: true });
  await fs.writeFile(path.join(metadata, "nodejs26.json"), "record");
  await expect(assertSafeRepositoryPaths(root)).rejects.toThrow("metadata path is not empty");
});
