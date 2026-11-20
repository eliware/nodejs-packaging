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
