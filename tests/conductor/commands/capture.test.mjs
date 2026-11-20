import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);

const spawn = jest.fn();
jest.unstable_mockModule("node:child_process", () => ({ spawn }));
const { default: runCommandCapture } = await import("../../../src/conductor/commands/capture.mjs");

function childWith({ code = 0, signal = null, stdout = "", stderr = "", error } = {}) {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  process.nextTick(() => {
    if (error) child.emit("error", error);
    else {
      child.stdout.end(stdout);
      child.stderr.end(stderr);
      child.emit("exit", code, signal);
    }
  });
  return child;
}

test("captures command output and uses default process settings", async () => {
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  spawn.mockImplementationOnce(() => childWith({ stdout: "captured", stderr: "warning" }));
  try {
    await expect(runCommandCapture("node", [])).resolves.toEqual({
      code: 0,
      stdout: "captured",
      stderr: "warning",
    });
    expect(spawn).toHaveBeenCalledWith(
      "node",
      [],
      expect.objectContaining({
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
    expect(stdout).toHaveBeenCalledWith("captured");
    expect(stderr).toHaveBeenCalledWith("warning");
  } finally {
    stdout.mockRestore();
    stderr.mockRestore();
  }
});

test("writes redacted logs while returning command output to the caller", async () => {
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  const webhook = "https://discordapp.com/api/webhooks/123/secretvalue";
  spawn.mockImplementationOnce(() => childWith({ stdout: webhook, stderr: "token=hidden-value" }));
  try {
    await expect(
      runCommandCapture("node", [], {
        logPath: "/virtual/logs/capture.log",
        logName: "capture",
        env: { DISCORD_WEBHOOK: webhook },
      }),
    ).resolves.toEqual({ code: 0, stdout: webhook, stderr: "token=hidden-value" });
    const log = await fs.readFile("/virtual/logs/capture.log", "utf8");
    expect(log).not.toContain(webhook);
    expect(log).not.toContain("hidden-value");
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("[REDACTED]"));
    spawn.mockImplementationOnce(() => childWith({ stdout: "quiet log" }));
    await expect(
      runCommandCapture("node", [], {
        quiet: true,
        logPath: "/virtual/logs/default-env.log",
        logName: "default",
      }),
    ).resolves.toEqual({ code: 0, stdout: "quiet log", stderr: "" });
  } finally {
    stdout.mockRestore();
    stderr.mockRestore();
  }
});

test("supports quiet output and reports command failures", async () => {
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  try {
    spawn.mockImplementationOnce(() => childWith({ stdout: "hidden", stderr: "hidden warning" }));
    await runCommandCapture("node", [], { quiet: true });
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
    spawn.mockImplementationOnce(() => childWith({ code: 3, stderr: "broken" }));
    await expect(runCommandCapture("tool", [])).rejects.toThrow("tool exited with code 3 : broken");
    spawn.mockImplementationOnce(() => childWith({ code: null, signal: "SIGTERM" }));
    await expect(runCommandCapture("tool", [], { quiet: true })).rejects.toThrow(
      "tool exited with code signal SIGTERM: ",
    );
    spawn.mockImplementationOnce(() => childWith({ error: new Error("capture failed") }));
    await expect(runCommandCapture("tool", [], { quiet: true })).rejects.toThrow("capture failed");
    spawn.mockImplementationOnce(() => childWith({ error: new Error("logged capture failed") }));
    await expect(
      runCommandCapture("tool", [], {
        quiet: true,
        logPath: "/virtual/logs/capture-error.log",
        logName: "capture-error",
      }),
    ).rejects.toThrow("logged capture failed");
    await expect(fs.readFile("/virtual/logs/capture-error.log", "utf8")).resolves.toContain(
      "logged capture failed",
    );
  } finally {
    stdout.mockRestore();
    stderr.mockRestore();
  }
});
