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
