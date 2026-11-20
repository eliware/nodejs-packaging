import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { expect, jest, test } from "@jest/globals";

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
  } finally {
    stdout.mockRestore();
    stderr.mockRestore();
  }
});
