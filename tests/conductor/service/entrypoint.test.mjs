import { expect, jest, test } from "@jest/globals";

const notifyConductor = jest.fn();
const runConductor = jest.fn(async () => {});
jest.unstable_mockModule("../../../src/discord-notifier.mjs", () => ({
  default: () => ({ notifyConductor }),
}));
jest.unstable_mockModule("../../../src/conductor/service/runner.mjs", () => ({
  default: runConductor,
}));
const { default: runService } = await import("../../../src/conductor/service/entrypoint.mjs");

test("uses default dependencies and completes successfully", async () => {
  runConductor.mockClear();
  const info = jest.spyOn(console, "info").mockImplementation(() => {});
  try {
    process.exitCode = 0;
    await runService();
    expect(runConductor).toHaveBeenNthCalledWith(1, "--dry-run", expect.any(Object));
    expect(runConductor).toHaveBeenNthCalledWith(2, "--wet-run", expect.any(Object));
    expect(process.exitCode).toBe(0);
  } finally {
    info.mockRestore();
  }
});

test("sets a failed process status when an injected run fails", async () => {
  const run = jest.fn().mockRejectedValue(new Error("preflight failed"));
  const notify = jest.fn();
  const info = jest.spyOn(console, "info").mockImplementation(() => {});
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    process.exitCode = 0;
    await runService({ run, notify });
    expect(run).toHaveBeenCalledWith("--dry-run");
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
    expect(process.exitCode).toBe(1);
  } finally {
    info.mockRestore();
    error.mockRestore();
    process.exitCode = 0;
  }
});
