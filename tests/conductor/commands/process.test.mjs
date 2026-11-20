import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { expect, jest, test } from "@jest/globals";

const spawn = jest.fn();
jest.unstable_mockModule("node:child_process", () => ({ spawn }));
const { default: runProcess } = await import("../../../src/conductor/commands/process.mjs");

function childWith({ streams = true, event = "exit", values = [0, null] } = {}) {
  const child = new EventEmitter();
  if (streams) {
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
  }
  process.nextTick(() => {
    if (streams) {
      child.stdout.end("out");
      child.stderr.end("err");
    }
    child.emit(event, ...values);
  });
  return child;
}

const handlers = {
  onStdout: jest.fn(),
  onStderr: jest.fn(),
  onError: jest.fn(),
  onExit: jest.fn(async () => ""),
};

test("resolves successful process lifecycle details", async () => {
  Object.values(handlers).forEach((handler) => handler.mockClear());
  spawn.mockImplementationOnce(() => childWith({ streams: false }));
  await expect(
    runProcess("node", ["script.mjs"], {
      cwd: "/virtual",
      env: {},
      stdio: ["ignore", "pipe", "pipe"],
      ...handlers,
    }),
  ).resolves.toEqual({ code: 0, stdout: "", stderr: "" });
  expect(spawn).toHaveBeenCalledWith("node", ["script.mjs"], {
    cwd: "/virtual",
    env: {},
    stdio: ["ignore", "pipe", "pipe"],
  });
  expect(handlers.onExit).toHaveBeenCalledWith({
    code: 0,
    signal: null,
    stdout: "",
    stderr: "",
  });
});

test("formats process failures and handles children without captured streams", async () => {
  Object.values(handlers).forEach((handler) => handler.mockClear());
  handlers.onExit.mockResolvedValueOnce(": safe error");
  spawn.mockImplementationOnce(() => childWith({ streams: false, values: [2, null] }));
  await expect(
    runProcess("/usr/bin/tool", [], {
      env: process.env,
      stdio: "inherit",
      ...handlers,
    }),
  ).rejects.toThrow("tool exited with code 2 : safe error");

  handlers.onExit.mockResolvedValueOnce(": stopped");
  spawn.mockImplementationOnce(() => childWith({ streams: false, values: [null, "SIGTERM"] }));
  await expect(
    runProcess("tool", [], { env: process.env, stdio: "inherit", ...handlers }),
  ).rejects.toThrow("tool exited with code signal SIGTERM: stopped");
});

test("rejects process errors and output-handler errors", async () => {
  const failure = new Error("spawn failed");
  spawn.mockImplementationOnce(() =>
    childWith({ streams: false, event: "error", values: [failure] }),
  );
  await expect(
    runProcess("tool", [], { env: process.env, stdio: "inherit", ...handlers }),
  ).rejects.toBe(failure);

  const loggingFailure = new Error("log failed");
  handlers.onError.mockRejectedValueOnce(loggingFailure);
  spawn.mockImplementationOnce(() =>
    childWith({ streams: false, event: "error", values: [failure] }),
  );
  await expect(
    runProcess("tool", [], { env: process.env, stdio: "inherit", ...handlers }),
  ).rejects.toBe(loggingFailure);

  handlers.onExit.mockRejectedValueOnce(loggingFailure);
  spawn.mockImplementationOnce(() => childWith());
  await expect(
    runProcess("tool", [], { env: process.env, stdio: "inherit", ...handlers }),
  ).rejects.toBe(loggingFailure);
});
