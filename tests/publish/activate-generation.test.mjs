import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: publishFilesystemModule } = await import("../../src/publish/filesystem.mjs");
const { default: activateModule } = await import("../../src/publish/activate-generation.mjs");
const files = publishFilesystemModule();
const activateGeneration = activateModule;

test("activates repository pointers, metadata, and public repository files", async () => {
  const root = "/virtual/activate-repository";
  const generation = path.join(root, ".generations/generation-1");
  await fs.mkdir(path.join(root, "metadata"), { recursive: true });
  await fs.mkdir(path.join(generation, "metadata/provenance"), { recursive: true });
  await fs.mkdir(path.join(generation, "metadata/releases"), { recursive: true });
  await fs.mkdir(path.join(generation, "metadata/validation"), { recursive: true });
  await fs.mkdir(path.join(generation, "el10/x86_64/stable"), { recursive: true });
  for (const file of [
    "metadata/catalog.json",
    "metadata/repository-index.json",
    "metadata/release-manifest.json",
    "metadata/release-manifest.json.asc",
    "metadata/active-generation.json",
  ]) {
    const source = path.join(generation, file);
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.writeFile(source, file);
  }
  await activateGeneration({
    repositoryRoot: root,
    generationRoot: generation,
    files,
  });
  expect((await fs.lstat(path.join(root, "el10/x86_64/stable"))).isSymbolicLink()).toBe(true);
  expect((await fs.lstat(path.join(root, "metadata/provenance"))).isSymbolicLink()).toBe(true);
  await expect(
    fs.readFile(path.join(root, "metadata/active-generation.json"), "utf8"),
  ).resolves.toBe("metadata/active-generation.json");
});

test("restores earlier pointers when a later pointer replacement fails", async () => {
  const root = "/virtual/activate-failure-repository";
  const generation = path.join(root, ".generations/generation-2");
  const stable = path.join(root, "el10/x86_64/stable");
  const oldStable = path.join(root, ".generations/generation-1/el10/x86_64/stable");
  const provenance = path.join(root, "metadata/provenance");
  await fs.mkdir(path.dirname(stable), { recursive: true });
  await fs.mkdir(path.join(root, "metadata"), { recursive: true });
  await fs.symlink(path.relative(path.dirname(stable), oldStable), stable);
  await fs.symlink("old-provenance", provenance);
  let replacements = 0;
  const failingFiles = {
    ...files,
    replacePointer: async (...args) => {
      replacements += 1;
      if (replacements === 2) throw new Error("pointer replacement failed");
      return files.replacePointer(...args);
    },
  };
  await expect(
    activateGeneration({
      repositoryRoot: root,
      generationRoot: generation,
      files: failingFiles,
    }),
  ).rejects.toThrow("pointer replacement failed");
  await expect(fs.readlink(stable)).resolves.toBe(path.relative(path.dirname(stable), oldStable));
  await expect(fs.readlink(provenance)).resolves.toBe("old-provenance");
});

test("restores an existing file pointer after activation fails", async () => {
  const root = "/virtual/activate-file-pointer-repository";
  const stable = path.join(root, "el10/x86_64/stable");
  await fs.mkdir(path.dirname(stable), { recursive: true });
  await fs.writeFile(stable, "previous stable pointer");
  const failingFiles = {
    ...files,
    replacePointer: async () => {
      throw new Error("pointer replacement failed");
    },
  };
  await expect(
    activateGeneration({
      repositoryRoot: root,
      generationRoot: path.join(root, ".generations/generation-3"),
      files: failingFiles,
    }),
  ).rejects.toThrow("pointer replacement failed");
  await expect(fs.readFile(stable, "utf8")).resolves.toBe("previous stable pointer");
});

test("reports pointer inspection errors before changing the generation", async () => {
  const root = "/virtual/activate-inspection-error-repository";
  await expect(
    activateGeneration({
      repositoryRoot: root,
      generationRoot: path.join(root, ".generations/generation-4"),
      files,
      inspectPointer: async () => {
        throw Object.assign(new Error("inspection denied"), { code: "EACCES" });
      },
    }),
  ).rejects.toThrow("inspection denied");
});

test("reports pointer restoration failures after an activation error", async () => {
  const root = "/virtual/activate-rollback-error-repository";
  const generation = path.join(root, ".generations/generation-5");
  const stable = path.join(root, "el10/x86_64/stable");
  const oldStable = path.join(root, ".generations/generation-4/el10/x86_64/stable");
  await fs.mkdir(path.dirname(stable), { recursive: true });
  await fs.mkdir(path.join(root, "metadata"), { recursive: true });
  await fs.symlink(path.relative(path.dirname(stable), oldStable), stable);
  let replacements = 0;
  const failingFiles = {
    ...files,
    replacePointer: async (...args) => {
      replacements += 1;
      if (replacements === 2) throw new Error("pointer replacement failed");
      if (replacements === 3) throw new Error("pointer restoration failed");
      return files.replacePointer(...args);
    },
  };
  await expect(
    activateGeneration({ repositoryRoot: root, generationRoot: generation, files: failingFiles }),
  ).rejects.toThrow("generation activation rollback failed");
});
