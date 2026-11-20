import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const activateGeneration = jest.fn();
const fingerprint = "A".repeat(40);
const signatureStatus = `[GNUPG:] VALIDSIG ${fingerprint} 2026-01-01 1 0 4 0 1 10 00 ${fingerprint}\n`;
const hash = "a".repeat(64);
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:child_process", () => ({
  spawnSync: jest.fn(() => ({ status: 0, stdout: signatureStatus })),
}));
jest.unstable_mockModule("../../../src/publish/activate-generation.mjs", () => ({
  default: activateGeneration,
}));
const { default: rollbackGeneration } = await import("../../../src/publish/rollback/run.mjs");

async function setup(root, generation) {
  const generationRoot = `${root}/.generations/${generation}`;
  const metadata = `${generationRoot}/metadata`;
  await fs.mkdir(metadata, { recursive: true });
  await fs.mkdir(`${generationRoot}/el10/x86_64/stable/repodata`, { recursive: true });
  await fs.writeFile(
    `${metadata}/active-generation.json`,
    JSON.stringify({ metadata_version: "0.1.0", schema: 1, generation }),
  );
  await fs.writeFile(`${metadata}/catalog.json`, "catalog");
  await fs.writeFile(`${generationRoot}/el10/x86_64/stable/repodata/repomd.xml`, "repodata");
  await fs.writeFile(`${generationRoot}/el10/x86_64/stable/node.rpm`, "rpm!");
  await fs.writeFile(
    `${metadata}/release-manifest.json`,
    JSON.stringify({
      metadata_version: "0.1.0",
      schema: 1,
      generation_id: generation,
      signed: true,
      publication_ready: true,
      catalog_sha256: hash,
      repository_metadata_sha256: hash,
      files: [{ path: "el10/x86_64/stable/node.rpm", sha256: hash, size: 4 }],
    }),
  );
}

const integrity = { hashFile: jest.fn(async () => hash), stat: jest.fn(async () => ({ size: 4 })) };

test("verifies and restores the requested retained stable generation", async () => {
  const root = "/virtual/rollback";
  const generation = "node-v26.1.2-el10-x86_64-20261120112233";
  await setup(root, generation);
  await expect(rollbackGeneration(root, generation, integrity)).rejects.toThrow(
    "trusted release signing fingerprint is required",
  );
  await expect(
    rollbackGeneration(root, generation, {
      keyFingerprint: fingerprint,
      gpgHome: "/keys",
      ...integrity,
    }),
  ).resolves.toBe(generation);
  expect(activateGeneration).toHaveBeenCalled();
  const verify = jest.fn(() => ({ status: 0, stdout: signatureStatus }));
  await expect(
    rollbackGeneration(root, generation, {
      verify,
      keyFingerprint: fingerprint,
      gpgHome: "/keys",
      activate: jest.fn(),
      files: fs,
      ...integrity,
    }),
  ).resolves.toBe(generation);
  expect(verify).toHaveBeenCalled();
});

test("rejects invalid and unsigned generations", async () => {
  const generation = "node-v26.1.2-el10-x86_64-20261120112233";
  await setup("/virtual/rollback-bad", generation);
  const activate = jest.fn();
  await expect(
    rollbackGeneration("/virtual/rollback-bad", generation, {
      verify: () => ({ status: 1, stderr: "invalid" }),
      keyFingerprint: fingerprint,
      gpgHome: "/keys",
      activate,
      ...integrity,
    }),
  ).rejects.toThrow("signature verification failed");
  expect(activate).not.toHaveBeenCalled();
});

test("uses the default dependency object when rejecting an invalid generation", async () => {
  await expect(rollbackGeneration("/virtual/rollback", "invalid")).rejects.toThrow(
    "retained stable generation identifier",
  );
});
