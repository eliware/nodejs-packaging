import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: publishFilesystemModule } = await import("../../src/publish/filesystem.mjs");
const { default: activateModule } = await import("../../src/publish/activate-generation.mjs");
const files = publishFilesystemModule();
const { activateGeneration } = activateModule();

test("activates repository pointers, metadata, and public repository files", async () => {
  const root = "/virtual/activate-repository";
  const generation = path.join(root, ".generations/generation-1");
  await fs.mkdir(path.join(root, "metadata"), { recursive: true });
  await fs.mkdir(path.join(generation, "metadata/provenance"), { recursive: true });
  await fs.mkdir(path.join(generation, "metadata/releases"), { recursive: true });
  await fs.mkdir(path.join(generation, "metadata/validation"), { recursive: true });
  await fs.mkdir(path.join(generation, "el10/x86_64/stable"), { recursive: true });
  await fs.mkdir(path.join(generation, "keys"), { recursive: true });
  for (const file of [
    "metadata/catalog.json",
    "metadata/repository-index.json",
    "metadata/release-manifest.json",
    "metadata/release-manifest.json.asc",
    "metadata/active-generation.json",
    "keys/RPM-GPG-KEY-ELIWARE-NODEJS",
    "nodejs26.repo",
  ]) {
    const source = path.join(generation, file);
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.writeFile(source, file);
  }
  await activateGeneration({
    repositoryRoot: root,
    generationRoot: generation,
    files,
    rootFiles: [
      { source: "keys/RPM-GPG-KEY-ELIWARE-NODEJS", destination: "keys/RPM-GPG-KEY-ELIWARE-NODEJS" },
      { source: "nodejs26.repo", destination: "nodejs26.repo" },
    ],
  });
  expect((await fs.lstat(path.join(root, "el10/x86_64/stable"))).isSymbolicLink()).toBe(true);
  expect((await fs.lstat(path.join(root, "metadata/provenance"))).isSymbolicLink()).toBe(true);
  await expect(
    fs.readFile(path.join(root, "metadata/active-generation.json"), "utf8"),
  ).resolves.toBe("metadata/active-generation.json");
  await expect(fs.readFile(path.join(root, "nodejs26.repo"), "utf8")).resolves.toBe(
    "nodejs26.repo",
  );
});
