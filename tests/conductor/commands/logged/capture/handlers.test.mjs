import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: createCaptureHandlers } =
  await import("../../../../../src/conductor/commands/logged/capture/handlers.mjs");

test("logs captured output and handles command failures", async () => {
  const handlers = createCaptureHandlers({
    logPath: "/virtual/logs/output.log",
    logName: "capture",
    quiet: true,
  });
  await handlers.onError(new Error("spawn failed"));
  const errorLog = await fs.readFile("/virtual/logs/output.log", "utf8");
  expect(errorLog).toContain("spawn failed");
  await handlers.onExit({ code: 1, stdout: "output", stderr: "failure" });
  const outputLog = await fs.readFile("/virtual/logs/output.log", "utf8");
  expect(outputLog).toContain("failure");
  const defaults = createCaptureHandlers();
  expect(defaults.onError(new Error("ignored"))).toBeUndefined();
});
