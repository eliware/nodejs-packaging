import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);

test("loads the active generation from repository metadata", async () => {
  await fs.mkdir("/virtual/repository/metadata", { recursive: true });
  await fs.writeFile(
    "/virtual/repository/metadata/active-generation.json",
    JSON.stringify({ generation: "generation-1" }),
  );
  const { default: loadActiveGeneration } =
    await import("../../src/repository-git/active-generation.mjs");
  await expect(loadActiveGeneration("/virtual/repository")).resolves.toBe("generation-1");
});
