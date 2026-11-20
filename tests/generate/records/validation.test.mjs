import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: writeValidationRecord } =
  await import("../../../src/generate/records/validation.mjs");

test("writes package validation metadata", async () => {
  await writeValidationRecord({
    candidate: "/virtual/candidate",
    version: "26.13.1",
    sourceInput: {
      source: {
        sha256: "a".repeat(64),
        signature_url: "https://nodejs.org/SHASUMS.sig",
        signing_key_fingerprint: "A".repeat(40),
        verified_at: "2026-11-19T12:00:00.000Z",
      },
    },
    rpmRecordUpdated: { npm_version: "12.2.3" },
    generated: "2026-11-20T00:00:00.000Z",
  });
  const record = JSON.parse(
    await fs.readFile("/virtual/candidate/metadata/validation/package.json", "utf8"),
  );
  expect(record).toMatchObject({
    node_version: "26.13.1",
    checks: { npm_version: "12.2.3" },
    status: "passed",
  });
});

test("requires evidence for both archive checks", async () => {
  const evidence = [
    undefined,
    {},
    { verified_at: "2026-11-19T12:00:00.000Z" },
    {
      verified_at: "2026-11-19T12:00:00.000Z",
      signature_url: "https://nodejs.org/SHASUMS.sig",
    },
    {
      verified_at: "2026-11-19T12:00:00.000Z",
      signature_url: "https://nodejs.org/SHASUMS.sig",
      signing_key_fingerprint: "bad",
      sha256: "a".repeat(64),
    },
    {
      verified_at: "2026-11-19T12:00:00.000Z",
      signature_url: "https://nodejs.org/SHASUMS.sig",
      signing_key_fingerprint: "A".repeat(40),
      sha256: "bad",
    },
  ];
  for (const source of evidence)
    await expect(
      writeValidationRecord({
        candidate: "/virtual/unverified-candidate",
        version: "26.13.1",
        sourceInput: { source },
        rpmRecordUpdated: { npm_version: "12.2.3" },
        generated: "2026-11-20T00:00:00.000Z",
      }),
    ).rejects.toThrow("verified Node.js archive evidence is required");
});
