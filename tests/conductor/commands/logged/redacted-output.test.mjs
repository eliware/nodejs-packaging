import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: createRedactedOutputHandlers } =
  await import("../../../../src/conductor/commands/logged/redacted-output.mjs");

test("redacts command errors and output before logging and streaming", async () => {
  const secret = "private-token";
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  try {
    const handlers = createRedactedOutputHandlers({
      logPath: "/virtual/logs/redacted.log",
      logName: "run",
      env: { API_TOKEN: secret },
    });
    await handlers.onError(new Error(secret));
    await handlers.onExit({ stdout: secret, stderr: "warning" });
    const log = await fs.readFile("/virtual/logs/redacted.log", "utf8");
    expect(log).not.toContain(secret);
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("[REDACTED]"));
    expect(stderr).toHaveBeenCalledWith("warning");
  } finally {
    stdout.mockRestore();
    stderr.mockRestore();
  }
});

test("uses the current environment by default", async () => {
  const handlers = createRedactedOutputHandlers({ logPath: "/virtual/logs/default.log" });
  expect(handlers.onStdout()).toBeUndefined();
  expect(handlers.onStderr()).toBeUndefined();
});
