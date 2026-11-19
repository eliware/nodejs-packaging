import { EventEmitter } from "node:events";
import path from "node:path";
import { expect, jest, test } from "@jest/globals";

const spawn = jest.fn();
const notifyConductor = jest.fn();
jest.unstable_mockModule("node:child_process", () => ({ spawn }));
jest.unstable_mockModule("../../src/discord-notifier.mjs", () => ({
  default: () => ({ notifyConductor }),
}));
const { default: serviceModule } = await import("../../src/conductor/service.mjs");
const { runConductorService, main } = serviceModule();

function childWith(event, ...values) {
  const child = new EventEmitter();
  process.nextTick(() => child.emit(event, ...values));
  return child;
}

test("runs preflight before the wet release", async () => {
  const calls = [];
  const succeeded = await runConductorService({
    run: async (mode) => calls.push(mode),
    notify: async () => {},
    log: { info() {}, error() {} },
  });
  expect(succeeded).toBe(true);
  expect(calls).toEqual(["--dry-run", "--wet-run"]);
});

test("uses console logging and reports dry-run and wet-run failures", async () => {
  const info = jest.spyOn(console, "info").mockImplementation(() => {});
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const notices = [];
    const dryRunSucceeded = await runConductorService({
      run: async () => {
        throw new Error("preflight failed");
      },
      notify: async (notice) => notices.push(notice),
    });
    expect(dryRunSucceeded).toBe(false);
    expect(notices[0]).toMatchObject({
      title: "Node.js conductor dry-run failed",
      description: "The preflight failed. The release run did not start.",
      status: "failure",
    });

    let calls = 0;
    const wetRunSucceeded = await runConductorService({
      run: async () => {
        calls += 1;
        if (calls === 2) throw new Error("release failed");
      },
      notify: async (notice) => notices.push(notice),
      log: { info() {}, error() {} },
    });
    expect(wetRunSucceeded).toBe(false);
    expect(notices[1]).toMatchObject({
      title: "Node.js conductor wet-run failed",
      description: "The release run stopped after preflight.",
    });
    expect(error).toHaveBeenCalled();
  } finally {
    info.mockRestore();
    error.mockRestore();
  }
});

test("runs the child conductor twice and returns a successful status", async () => {
  spawn.mockReset().mockImplementation(() => childWith("exit", 0, null));
  const info = jest.spyOn(console, "info").mockImplementation(() => {});
  try {
    process.exitCode = 0;
    await main();
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(spawn).toHaveBeenNthCalledWith(
      1,
      process.execPath,
      [path.resolve("src/bin/conductor.mjs"), "--dry-run"],
      expect.objectContaining({ env: process.env, stdio: "inherit" }),
    );
    expect(process.exitCode).toBe(0);
  } finally {
    info.mockRestore();
  }
});

test("reports child exit codes, signals, and spawn errors", async () => {
  const notices = [];
  const log = { info() {}, error: jest.fn() };
  const info = jest.spyOn(console, "info").mockImplementation(() => {});
  const original = console.error;
  console.error = log.error;
  try {
    spawn.mockReset().mockImplementation(() => childWith("exit", 7, null));
    process.exitCode = 0;
    await main({ notify: async (notice) => notices.push(notice) });
    expect(process.exitCode).toBe(1);
    expect(notices.at(-1)).toMatchObject({
      title: "Node.js conductor dry-run failed",
      fields: expect.arrayContaining([{ name: "Error", value: "conductor exited with code 7 " }]),
    });

    spawn.mockReset().mockImplementation(() => childWith("exit", null, "SIGTERM"));
    await main({ notify: async (notice) => notices.push(notice) });
    expect(notices.at(-1).fields).toContainEqual({
      name: "Error",
      value: "conductor exited with code signal SIGTERM",
    });

    spawn.mockReset().mockImplementation(() => childWith("error", new Error("spawn failed")));
    await main({ notify: async (notice) => notices.push(notice) });
    expect(notices.at(-1).fields).toContainEqual({ name: "Error", value: "spawn failed" });
  } finally {
    info.mockRestore();
    console.error = original;
    process.exitCode = 0;
  }
});

test("uses injected service dependencies and sets a failed process status", async () => {
  const run = jest.fn().mockRejectedValue(new Error("preflight failed"));
  const notify = jest.fn();
  const info = jest.spyOn(console, "info").mockImplementation(() => {});
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    process.exitCode = 0;
    await main({ run, notify });
    expect(run).toHaveBeenCalledWith("--dry-run");
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
    expect(process.exitCode).toBe(1);
  } finally {
    info.mockRestore();
    error.mockRestore();
    process.exitCode = 0;
  }
});
