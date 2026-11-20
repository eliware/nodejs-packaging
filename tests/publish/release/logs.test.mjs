import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: copyReleaseLogs } = await import("../../../src/publish/release/logs.mjs");

test("copies conductor logs into the staged release metadata", async () => {
  const stage = "/virtual/release-stage";
  const logs = "/virtual/conductor-logs";
  await fs.mkdir(logs, { recursive: true });
  await fs.writeFile(path.join(logs, "release.log"), "release output");
  await copyReleaseLogs(stage, {
    NODEJS_CONDUCTOR_LOG_DIR: logs,
    NODEJS_CONDUCTOR_RUN_ID: "run-9",
  });
  await expect(
    fs.readFile(path.join(stage, "metadata/logs/run-9/release.log"), "utf8"),
  ).resolves.toBe("release output");
});

test("skips log copying when conductor log settings are incomplete", async () => {
  await expect(copyReleaseLogs("/virtual/release-stage", {})).resolves.toBeUndefined();
});
