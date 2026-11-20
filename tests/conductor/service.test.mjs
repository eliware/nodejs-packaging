import { expect, jest, test } from "@jest/globals";
import runConductorService from "../../src/conductor/service.mjs";

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

test("reports a dry-run failure and preserves a failed process status", async () => {
  const run = jest.fn().mockRejectedValue(new Error("preflight failed"));
  const notify = jest.fn();
  const info = jest.spyOn(console, "info").mockImplementation(() => {});
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    process.exitCode = 0;
    const succeeded = await runConductorService({ run, notify });
    expect(succeeded).toBe(false);
    expect(run).toHaveBeenCalledWith("--dry-run");
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Node.js conductor dry-run failed",
        description: "The preflight failed. The release run did not start.",
        status: "failure",
      }),
    );
    expect(process.exitCode).toBe(0);
  } finally {
    info.mockRestore();
    error.mockRestore();
  }
});

test("reports a wet-run failure after preflight", async () => {
  let calls = 0;
  const notices = [];
  const succeeded = await runConductorService({
    run: async () => {
      calls += 1;
      if (calls === 2) throw new Error("release failed");
    },
    notify: async (notice) => notices.push(notice),
    log: { info() {}, error() {} },
  });
  expect(succeeded).toBe(false);
  expect(notices[0]).toMatchObject({
    title: "Node.js conductor wet-run failed",
    description: "The release run stopped after preflight.",
  });
});

test("reports a notification failure", async () => {
  const error = jest.fn();
  const succeeded = await runConductorService({
    run: async () => {
      throw new Error("preflight failed");
    },
    notify: async () => {
      throw new Error("notification failed");
    },
    log: { info() {}, error },
  });
  expect(succeeded).toBe(false);
  expect(error).toHaveBeenCalledWith(
    "[conductor-service] failure notification failed: notification failed",
  );
});
