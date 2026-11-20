import { expect, jest, test } from "@jest/globals";
import reportConductorFailure from "../../../src/conductor/failure/report.mjs";

test("logs and notifies about a wet-run failure", async () => {
  const log = { error: jest.fn() };
  const notifyConductor = jest.fn();
  const oldService = process.env.NODEJS_CONDUCTOR_SERVICE;
  delete process.env.NODEJS_CONDUCTOR_SERVICE;
  try {
    await reportConductorFailure({
      error: new Error("release failed"),
      stage: "publish",
      dryRun: false,
      runId: "run-1",
      notifyConductor,
      log,
    });
    expect(log.error).toHaveBeenCalledWith("[conductor] publish failed: release failed");
    expect(notifyConductor).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Node.js conductor publish failed",
        fields: expect.arrayContaining([{ name: "Run", value: "run-1" }]),
      }),
    );
  } finally {
    if (oldService === undefined) delete process.env.NODEJS_CONDUCTOR_SERVICE;
    else process.env.NODEJS_CONDUCTOR_SERVICE = oldService;
  }
});

test.each([
  { dryRun: true, service: undefined },
  { dryRun: false, service: "true" },
])("suppresses notices for dry-run or service failures", async ({ dryRun, service }) => {
  const notifyConductor = jest.fn();
  await reportConductorFailure({
    error: new Error("failed"),
    stage: "preflight",
    dryRun,
    runId: "run-2",
    notifyConductor,
    log: { error: jest.fn() },
    service,
  });
  expect(notifyConductor).not.toHaveBeenCalled();
});

test("handles a failed notification without rejecting the report", async () => {
  const log = { error: jest.fn() };
  await expect(
    reportConductorFailure({
      error: new Error("release failed"),
      stage: "publish",
      dryRun: false,
      runId: "run-3",
      notifyConductor: jest.fn().mockRejectedValue(new Error("webhook unavailable")),
      log,
      service: undefined,
    }),
  ).resolves.toBeUndefined();
  expect(log.error).toHaveBeenCalledWith(
    "[conductor] failure notification failed: webhook unavailable",
  );
});
