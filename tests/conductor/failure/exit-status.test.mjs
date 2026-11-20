import { expect, test } from "@jest/globals";
import setFailureExitStatus from "../../../src/conductor/failure/exit-status.mjs";

test("sets a failing process status", () => {
  const oldStatus = process.exitCode;
  try {
    process.exitCode = 0;
    setFailureExitStatus();
    expect(process.exitCode).toBe(1);
  } finally {
    process.exitCode = oldStatus;
  }
});
