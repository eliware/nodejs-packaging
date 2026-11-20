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
  await handlers.onExit({ code: 1, stdout: "output", stderr: "failure" });
  await createCaptureHandlers().onExit({ code: 0, stdout: "", stderr: "" });
  const outputLog = await fs.readFile("/virtual/logs/output.log", "utf8");
  expect(outputLog).toContain("failure");
});
