import { expect, jest, test } from "@jest/globals";
import runConductorBoundary from "../../src/conductor/failure-handling.mjs";

test("returns the workflow result and releases its lock", async () => {
  const cleanup = jest.fn();
  await expect(
    runConductorBoundary({ run: async () => "complete", getFailureState: () => ({}), cleanup }),
  ).resolves.toBe("complete");
  expect(cleanup).toHaveBeenCalled();
});

test("reports wet-run failures and releases the lock", async () => {
  const notifyConductor = jest.fn();
  const cleanup = jest.fn();
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  const oldStatus = process.exitCode;
  try {
    process.exitCode = 0;
    await runConductorBoundary({
      run: async () => {
        throw new Error("release failed");
      },
      getFailureState: () => ({ stage: "publish", dryRun: false, runId: "run-1", notifyConductor }),
      cleanup,
    });
    expect(process.exitCode).toBe(1);
    expect(notifyConductor).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Node.js conductor publish failed",
        fields: expect.arrayContaining([{ name: "Error", value: "release failed" }]),
      }),
    );
    expect(cleanup).toHaveBeenCalled();
  } finally {
    error.mockRestore();
    process.exitCode = oldStatus;
  }
});

test("reports cleanup failures and returns a failing process status", async () => {
  const oldStatus = process.exitCode;
  const reportFailure = jest.fn();
  try {
    process.exitCode = 0;
    await runConductorBoundary({
      run: async () => "complete",
      getFailureState: () => ({ stage: "cleanup", runId: "run-3" }),
      cleanup: async () => {
        throw new Error("lock cleanup failed");
      },
      reportFailure,
    });
    expect(process.exitCode).toBe(1);
    expect(reportFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: "lock cleanup failed" }),
        stage: "cleanup",
      }),
    );
  } finally {
    process.exitCode = oldStatus;
  }
});

test("logs cleanup failures after reporting the workflow failure", async () => {
  const oldStatus = process.exitCode;
  const reportFailure = jest.fn();
  const log = { error: jest.fn() };
  try {
    process.exitCode = 0;
    await runConductorBoundary({
      run: async () => {
        throw new Error("release failed");
      },
      getFailureState: () => ({}),
      cleanup: async () => {
        throw new Error("lock cleanup failed");
      },
      reportFailure,
      log,
    });
    expect(reportFailure).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith("[conductor] cleanup failed: lock cleanup failed");
  } finally {
    process.exitCode = oldStatus;
  }
});

test.each([
  { dryRun: true, service: undefined },
  { dryRun: false, service: "true" },
])("suppresses notifications for dry-run or service failures", async ({ dryRun, service }) => {
  const notifyConductor = jest.fn();
  const cleanup = jest.fn();
  const oldService = process.env.NODEJS_CONDUCTOR_SERVICE;
  process.exitCode = 0;
  if (service === undefined) delete process.env.NODEJS_CONDUCTOR_SERVICE;
  else process.env.NODEJS_CONDUCTOR_SERVICE = service;
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    await runConductorBoundary({
      run: async () => {
        throw new Error("failed");
      },
      getFailureState: () => ({ stage: "preflight", dryRun, runId: "run-2", notifyConductor }),
      cleanup,
    });
    expect(notifyConductor).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalled();
  } finally {
    error.mockRestore();
    process.exitCode = 0;
    if (oldService === undefined) delete process.env.NODEJS_CONDUCTOR_SERVICE;
    else process.env.NODEJS_CONDUCTOR_SERVICE = oldService;
  }
});
