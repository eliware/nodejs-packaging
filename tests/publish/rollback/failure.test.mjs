import { expect, jest, test } from "@jest/globals";
import reportRollbackFailure from "../../../src/publish/rollback/failure.mjs";

test("reports a rollback error and sets a failed process status", () => {
  const oldStatus = process.exitCode;
  const output = { error: jest.fn() };
  try {
    process.exitCode = 0;
    reportRollbackFailure(new Error("rollback failed"), output);
    expect(output.error).toHaveBeenCalledWith("rollback failed");
    expect(process.exitCode).toBe(1);
  } finally {
    process.exitCode = oldStatus;
  }
});

test("reports errors to the default output", () => {
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  const oldStatus = process.exitCode;
  try {
    reportRollbackFailure(new Error("rollback failed"));
    expect(error).toHaveBeenCalledWith("rollback failed");
    expect(process.exitCode).toBe(1);
  } finally {
    error.mockRestore();
    process.exitCode = oldStatus;
  }
});
