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

test.each([
  {
    phase: "dry-run",
    error: "preflight failed",
    description: "The preflight failed. The release run did not start.",
    expectedCalls: ["--dry-run"],
  },
  {
    phase: "wet-run",
    error: "release failed",
    description: "The release run stopped after preflight.",
    expectedCalls: ["--dry-run", "--wet-run"],
  },
])("reports a $phase failure", async ({ phase, error: message, description, expectedCalls }) => {
  const calls = [];
  const notices = [];
  const succeeded = await runConductorService({
    run: async (mode) => {
      calls.push(mode);
      if (mode === `--${phase}`) throw new Error(message);
    },
    notify: async (notice) => notices.push(notice),
    log: { info() {}, error() {} },
  });
  expect(succeeded).toBe(false);
  expect(calls).toEqual(expectedCalls);
  expect(notices).toHaveLength(1);
  expect(notices[0]).toMatchObject({
    title: `Node.js conductor ${phase} failed`,
    description,
    status: "failure",
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
