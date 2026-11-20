import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const activateGeneration = jest.fn();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:child_process", () => ({
  spawnSync: jest.fn(() => ({ status: 0 })),
}));
jest.unstable_mockModule("../../src/publish/activate-generation.mjs", () => ({
  default: () => ({ activateGeneration }),
}));
const { default: moduleApi } = await import("../../src/publish/rollback.mjs");
const { rollbackGeneration } = moduleApi();

async function setup(root, generation) {
  const metadata = `${root}/.generations/${generation}/metadata`;
  await fs.mkdir(metadata, { recursive: true });
  await fs.writeFile(`${metadata}/active-generation.json`, JSON.stringify({ generation }));
}

test("verifies and restores the requested retained stable generation", async () => {
  const root = "/virtual/rollback";
  const generation = "node-v26.1.2-el10-x86_64-20261120112233";
  await setup(root, generation);
  await expect(rollbackGeneration(root, generation)).resolves.toBe(generation);
  expect(activateGeneration).toHaveBeenCalled();
  await expect(
    rollbackGeneration(root, generation, { verify: () => ({ error: new Error("spawn") }) }),
  ).rejects.toThrow("spawn");
  await expect(
    rollbackGeneration(root, generation, {
      verify: () => ({ status: 0 }),
      activate: jest.fn(),
      files: fs,
    }),
  ).resolves.toBe(generation);
});

test("rejects invalid and unsigned generations", async () => {
  await expect(rollbackGeneration("/virtual")).rejects.toThrow("retained stable generation");
  await expect(rollbackGeneration("/virtual")).rejects.toThrow("retained stable generation");
  await expect(rollbackGeneration("/virtual", "seed")).rejects.toThrow(
    "retained stable generation",
  );
  const generation = "node-v26.1.2-el10-x86_64-20261120112233";
  await setup("/virtual/rollback-bad", generation);
  await fs.writeFile(
    `${"/virtual/rollback-bad"}/.generations/${generation}/metadata/active-generation.json`,
    JSON.stringify({ generation: "another" }),
  );
  await expect(rollbackGeneration("/virtual/rollback-bad", generation)).rejects.toThrow(
    "does not match",
  );
  await fs.writeFile(
    `${"/virtual/rollback-bad"}/.generations/${generation}/metadata/active-generation.json`,
    JSON.stringify({ generation }),
  );
  await expect(
    rollbackGeneration("/virtual/rollback-bad", generation, { verify: () => ({ status: 1 }) }),
  ).rejects.toThrow("unknown error");
  await expect(
    rollbackGeneration("/virtual/rollback-bad", generation, {
      verify: () => ({ status: 1, stderr: "invalid" }),
    }),
  ).rejects.toThrow("signature verification failed");
});
