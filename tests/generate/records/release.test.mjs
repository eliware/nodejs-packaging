import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: writeReleaseRecord } = await import("../../../src/generate/records/release.mjs");

test("writes the stable Node.js release record", async () => {
  const oldRunId = process.env.NODEJS_CONDUCTOR_RUN_ID;
  process.env.NODEJS_CONDUCTOR_RUN_ID = "run-1";
  try {
    const release = await writeReleaseRecord({
      candidate: "/virtual/candidate",
      generationId: "generation-1",
      version: "26.13.1",
      sourceInput: { source: { sha256: "a" }, npm: { version: "12.2.3" } },
      rpmRecordUpdated: { path: "node.rpm" },
      generated: "2026-11-20T00:00:00.000Z",
    });
    expect(release).toMatchObject({
      release_id: "node-v26.13.1-el10-x86_64",
      logs_path: "metadata/logs/run-1/",
    });
    await expect(
      fs.readFile("/virtual/candidate/metadata/releases/nodejs26.json", "utf8"),
    ).resolves.toContain('"channel": "stable"');
  } finally {
    if (oldRunId === undefined) delete process.env.NODEJS_CONDUCTOR_RUN_ID;
    else process.env.NODEJS_CONDUCTOR_RUN_ID = oldRunId;
  }
});
