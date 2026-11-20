import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: copyRootFiles } = await import("../../src/publish/root-files.mjs");

test("copies public files from a generation into repository root paths", async () => {
  const root = "/virtual/root-files";
  const generation = path.join(root, "generation");
  await fs.mkdir(path.join(generation, "keys"), { recursive: true });
  await fs.writeFile(path.join(generation, "keys/signing-key"), "key");
  await fs.writeFile(path.join(generation, "nodejs.repo"), "repo");
  await copyRootFiles({
    repositoryRoot: root,
    generationRoot: generation,
    rootFiles: [
      { source: "keys/signing-key", destination: "keys/signing-key" },
      { source: "nodejs.repo", destination: "config/nodejs.repo" },
    ],
  });
  await expect(fs.readFile(path.join(root, "keys/signing-key"), "utf8")).resolves.toBe("key");
  await expect(fs.readFile(path.join(root, "config/nodejs.repo"), "utf8")).resolves.toBe("repo");
});
