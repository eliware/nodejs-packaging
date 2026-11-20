import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);

const spawn = jest.fn();
jest.unstable_mockModule("node:child_process", () => ({ spawn }));
const { default: runCommand } = await import("../../../src/conductor/commands/run.mjs");

function childWith(event, ...values) {
  const child = new EventEmitter();
  process.nextTick(() => child.emit(event, ...values));
  return child;
}

test("runs commands with inherited streams and explicit settings", async () => {
  spawn.mockImplementationOnce(() => childWith("exit", 0, null));
  await expect(runCommand("node", ["script.mjs"], { env: {}, cwd: "/virtual" })).resolves.toEqual({
    code: 0,
  });
  expect(spawn).toHaveBeenCalledWith("node", ["script.mjs"], {
    cwd: "/virtual",
    env: {},
    stdio: "inherit",
  });
});

test("captures and redacts logs when a log path is provided", async () => {
  const output = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const errorOutput = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  spawn.mockImplementationOnce(() => {
    process.nextTick(() => {
      child.stdout.end("DISCORD_WEBHOOK=super-secret-value");
      child.stderr.end("token=private-token");
      child.emit("exit", 0, null);
    });
    return child;
  });
  await expect(
    runCommand("node", [], {
      logPath: "/virtual/logs/build.log",
      logName: "build",
      env: { DISCORD_WEBHOOK: "super-secret-value" },
    }),
  ).resolves.toEqual({ code: 0 });
  const log = await fs.readFile("/virtual/logs/build.log", "utf8");
  expect(log).not.toContain("super-secret-value");
  expect(log).not.toContain("private-token");
  output.mockRestore();
  errorOutput.mockRestore();
});

test("uses the process environment for logged commands when no environment is supplied", async () => {
  const output = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const errorOutput = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  spawn.mockImplementationOnce(() => {
    process.nextTick(() => {
      child.stdout.end("done");
      child.stderr.end("");
      child.emit("exit", 0, null);
    });
    return child;
  });
  try {
    await expect(
      runCommand("node", [], { logPath: "/virtual/logs/default-env.log", logName: "check" }),
    ).resolves.toEqual({ code: 0 });
  } finally {
    output.mockRestore();
    errorOutput.mockRestore();
  }
});

test("preserves spawn errors in local log files", async () => {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  spawn.mockImplementationOnce(() => {
    process.nextTick(() => child.emit("error", new Error("spawn failed")));
    return child;
  });
  await expect(
    runCommand("node", [], { logPath: "/virtual/logs/error.log", logName: "spawn" }),
  ).rejects.toThrow("spawn failed");
  await expect(fs.readFile("/virtual/logs/error.log", "utf8")).resolves.toContain("spawn failed");
});

test("reports command exit, signal, and spawn failures", async () => {
  spawn.mockImplementationOnce(() => childWith("exit", 7, null));
  await expect(runCommand("node", [])).rejects.toThrow("node exited with code 7 ");
  spawn.mockImplementationOnce(() => childWith("exit", null, "SIGTERM"));
  await expect(runCommand("node", [])).rejects.toThrow("node exited with code signal SIGTERM");
  spawn.mockImplementationOnce(() => childWith("error", new Error("spawn failed")));
  await expect(runCommand("node", [])).rejects.toThrow("spawn failed");
});
