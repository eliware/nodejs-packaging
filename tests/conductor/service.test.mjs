import { expect, jest, test } from "@jest/globals";

const notifyConductor = jest.fn();
const runConductor = jest.fn(async () => {});
jest.unstable_mockModule("../../src/discord-notifier.mjs", () => ({
  default: () => ({ notifyConductor }),
}));
jest.unstable_mockModule("../../src/conductor/service/runner.mjs", () => ({
  default: () => ({ runConductor }),
}));
const { default: serviceModule } = await import("../../src/conductor/service.mjs");
const { runConductorService, main } = serviceModule();

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

test("uses default service dependencies and completes successfully", async () => {
  runConductor.mockClear();
  const info = jest.spyOn(console, "info").mockImplementation(() => {});
  try {
    process.exitCode = 0;
    await main();
    expect(runConductor).toHaveBeenNthCalledWith(1, "--dry-run", expect.any(Object));
    expect(runConductor).toHaveBeenNthCalledWith(2, "--wet-run", expect.any(Object));
    expect(process.exitCode).toBe(0);
  } finally {
    info.mockRestore();
  }
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

test("keeps the failed process status when failure notification rejects", async () => {
  const run = jest.fn().mockRejectedValue(new Error("preflight failed"));
  const notify = jest.fn().mockRejectedValue(new Error("notification failed"));
  const info = jest.spyOn(console, "info").mockImplementation(() => {});
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    process.exitCode = 0;
    await expect(
      runConductorService({ run, notify, log: { info() {}, error() {} } }),
    ).resolves.toBe(false);
    await main({ run, notify });
    expect(process.exitCode).toBe(1);
    expect(error).toHaveBeenCalledWith(
      "[conductor-service] failure notification failed: notification failed",
    );
  } finally {
    info.mockRestore();
    error.mockRestore();
    process.exitCode = 0;
  }
});
