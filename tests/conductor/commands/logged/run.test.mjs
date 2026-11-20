import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const spawn = jest.fn();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:child_process", () => ({ spawn }));
const { default: runLoggedCommand } =
  await import("../../../../src/conductor/commands/logged/run.mjs");

function childWith(stdout, stderr) {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  process.nextTick(() => {
    child.stdout.end(stdout);
    child.stderr.end(stderr);
    child.emit("exit", 0, null);
  });
  return child;
}

test("writes redacted command output to its log and streams", async () => {
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  spawn.mockImplementationOnce(() => childWith("secret-value", "warning"));
  try {
    await expect(
      runLoggedCommand("node", [], {
        logPath: "/virtual/logs/run.log",
        logName: "node",
        env: { API_KEY: "secret-value" },
      }),
    ).resolves.toEqual({ code: 0 });
    await expect(fs.readFile("/virtual/logs/run.log", "utf8")).resolves.not.toContain(
      "secret-value",
    );
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("[REDACTED]"));
    expect(stderr).toHaveBeenCalledWith("warning");
  } finally {
    stdout.mockRestore();
    stderr.mockRestore();
  }
});
