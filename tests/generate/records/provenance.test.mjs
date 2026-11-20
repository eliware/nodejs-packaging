import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: writeProvenanceRecord } =
  await import("../../../src/generate/records/provenance.mjs");

test("writes provenance with source, package, and optional run log data", async () => {
  const oldRunId = process.env.NODEJS_CONDUCTOR_RUN_ID;
  delete process.env.NODEJS_CONDUCTOR_RUN_ID;
  try {
    const record = await writeProvenanceRecord({
      candidate: "/virtual/candidate",
      generationId: "generation-1",
      version: "26.13.1",
      sourceInput: { source: { sha256: "a" }, npm: { version: "12.2.3" } },
      rpmRecordUpdated: { path: "node.rpm" },
      generated: "2026-11-20T00:00:00.000Z",
    });
    expect(record).toMatchObject({
      node_version: "26.13.1",
      validation_path: "metadata/validation/package.json",
    });
    expect(record).not.toHaveProperty("logs_path");
    await expect(
      fs.readFile("/virtual/candidate/metadata/provenance/package.json", "utf8"),
    ).resolves.toContain('"generation_id": "generation-1"');
  } finally {
    if (oldRunId !== undefined) process.env.NODEJS_CONDUCTOR_RUN_ID = oldRunId;
  }
});
