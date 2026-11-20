import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: handleCaptureError } =
  await import("../../../../../src/conductor/commands/logged/capture/error-handler.mjs");

test("writes a spawn error to the command log", async () => {
  await handleCaptureError(
    new Error("process failed"),
    { logPath: "/virtual/capture/error.log", logName: "capture" },
    {},
  );
  await expect(fs.readFile("/virtual/capture/error.log", "utf8")).resolves.toContain(
    "process failed",
  );
});

test("does nothing when no command log exists", () => {
  expect(handleCaptureError(new Error("ignored"), {}, {})).toBeUndefined();
});
