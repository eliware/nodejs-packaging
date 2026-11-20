import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: publishReportRecord } = await import("../../src/report/publish.mjs");

test("writes a report record to its run directory", async () => {
  const reportPath = "/virtual/report-publish/metadata/runs/run-1/release-report.json";
  await publishReportRecord({ reportPath, report: { run_id: "run-1" } });
  await expect(fs.readFile(reportPath, "utf8")).resolves.toBe('{\n  "run_id": "run-1"\n}\n');
});
