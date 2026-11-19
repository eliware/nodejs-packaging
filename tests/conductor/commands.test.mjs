import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { expect, jest, test } from "@jest/globals";
const spawn = jest.fn();
jest.unstable_mockModule("node:child_process", () => ({ spawn }));
const { default: commandsModule } = await import("../../src/conductor/commands.mjs");
const { runCommand, runCommandCapture } = commandsModule();

function childProcess({ code = 0, signal = null, stdout = "", stderr = "", error } = {}) {
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

test("runs a command with inherited streams and explicit settings", async () => {
  spawn.mockImplementationOnce(() => childProcess());
  await expect(runCommand("node", ["script.mjs"], { env: {}, cwd: "/virtual" })).resolves.toEqual({
    code: 0,
  });
  expect(spawn).toHaveBeenCalledWith("node", ["script.mjs"], {
    cwd: "/virtual",
    env: {},
    stdio: "inherit",
  });
});

test("reports failed commands, signals, and spawn errors", async () => {
  spawn.mockImplementationOnce(() => childProcess({ code: 7 }));
  await expect(runCommand("node", [])).rejects.toThrow("node exited with code 7 ");
  spawn.mockImplementationOnce(() => childProcess({ code: null, signal: "SIGTERM" }));
  await expect(runCommand("node", [])).rejects.toThrow("node exited with code signal SIGTERM");
  spawn.mockImplementationOnce(() => childProcess({ error: new Error("spawn failed") }));
  await expect(runCommand("node", [])).rejects.toThrow("spawn failed");
});

test("captures output quietly and uses default process settings", async () => {
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  spawn.mockImplementationOnce(() => childProcess({ stdout: "captured", stderr: "warning" }));
  try {
    await expect(runCommandCapture("node", [])).resolves.toEqual({
      code: 0,
      stdout: "captured",
      stderr: "warning",
    });
    expect(spawn).toHaveBeenLastCalledWith(
      "node",
      [],
      expect.objectContaining({
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
  } finally {
    stdout.mockRestore();
    stderr.mockRestore();
  }
});

test("forwards output and reports capture failures with and without a signal", async () => {
  const stdoutWrite = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderrWrite = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  try {
    spawn.mockImplementationOnce(() =>
      childProcess({ stdout: "quiet output", stderr: "quiet warning" }),
    );
    await runCommandCapture("node", [], { quiet: true });
    spawn.mockImplementationOnce(() => childProcess({ stdout: "visible", stderr: "warning" }));
    await runCommandCapture("node", []);
    expect(stdoutWrite).toHaveBeenCalledWith("visible");
    expect(stderrWrite).toHaveBeenCalledWith("warning");
    spawn.mockImplementationOnce(() => childProcess({ code: 3, stderr: "broken" }));
    await expect(runCommandCapture("tool", [])).rejects.toThrow("tool exited with code 3 : broken");
    spawn.mockImplementationOnce(() => childProcess({ code: null, signal: "SIGTERM" }));
    await expect(runCommandCapture("tool", [], { quiet: true })).rejects.toThrow(
      "tool exited with code signal SIGTERM: ",
    );
    spawn.mockImplementationOnce(() => childProcess({ error: new Error("capture failed") }));
    await expect(runCommandCapture("tool", [], { quiet: true })).rejects.toThrow("capture failed");
  } finally {
    stdoutWrite.mockRestore();
    stderrWrite.mockRestore();
  }
});
