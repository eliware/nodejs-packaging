import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: imageGeneration } = await import("../../../src/publish/image/generation.mjs");
const { stageImageGeneration, cleanupImageGeneration } = imageGeneration();

test("stages an image generation and copies source files", async () => {
  const repositoryRoot = "/virtual/image-repository";
  const oldRoot = path.join(repositoryRoot, "old");
  await fs.mkdir(oldRoot, { recursive: true });
  await fs.writeFile(path.join(oldRoot, "catalog.json"), "{}");
  const result = await stageImageGeneration({
    repositoryRoot,
    oldRoot,
    image: { source_release: "26.13.1" },
    generated: "2026-11-19T12:00:00.000Z",
  });
  expect(result.generationId).toBe("node-v26.13.1-el10-x86_64-20261119120000000");
  await expect(fs.readFile(path.join(result.stage, "catalog.json"), "utf8")).resolves.toBe("{}");
  await expect(
    stageImageGeneration({
      repositoryRoot,
      oldRoot,
      image: { source_release: "26.13.1" },
      generated: "2026-11-19T12:00:00.000Z",
    }),
  ).rejects.toThrow("generation already exists");
  await cleanupImageGeneration({ ...result, activationStarted: false });
  await expect(fs.stat(result.stage)).rejects.toMatchObject({ code: "ENOENT" });
});

test("keeps an activated generation during cleanup", async () => {
  const root = "/virtual/image-cleanup";
  await fs.mkdir(root, { recursive: true });
  const stage = path.join(root, "stage");
  const finalRoot = path.join(root, "final");
  await fs.mkdir(stage);
  await fs.mkdir(finalRoot);
  await cleanupImageGeneration({ stage, finalRoot, activationStarted: true });
  await expect(fs.stat(stage)).rejects.toMatchObject({ code: "ENOENT" });
  await expect(fs.stat(finalRoot)).resolves.toBeDefined();
});
