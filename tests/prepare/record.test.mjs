import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: writeReleaseRecord } = await import("../../src/prepare/record.mjs");

test("writes a release input record with verified source and npm data", async () => {
  const outputDir = "/virtual/release-input";
  await fs.mkdir(outputDir, { recursive: true });
  const now = new Date("2026-11-19T12:00:00.000Z");
  const release = {
    source: {
      url: "https://nodejs.org/node.tar.xz",
      file: "node.tar.xz",
      signature_url: "https://nodejs.org/SHASUMS.sig",
    },
  };
  const npmRelease = {
    version: "12.2.3",
    file: "npm.tgz",
    url: "https://registry.npmjs.org/npm.tgz",
    integrity: "sha512-valid",
  };
  const record = await writeReleaseRecord({
    outputDir,
    version: "26.13.1",
    release,
    npmRelease,
    fingerprint: "A".repeat(40),
    archiveSha256: "b".repeat(64),
    now,
  });
  expect(record).toEqual(
    expect.objectContaining({
      release_id: "node-v26.13.1-el10-x86_64",
      source: expect.objectContaining({
        sha256: "b".repeat(64),
        signing_key_fingerprint: "A".repeat(40),
        verified_at: now.toISOString(),
      }),
      npm: npmRelease,
      prepared_at: now.toISOString(),
    }),
  );
  expect(JSON.parse(await fs.readFile(path.join(outputDir, "release-input.json"), "utf8"))).toEqual(
    record,
  );
});
