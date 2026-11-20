import { expect, jest, test } from "@jest/globals";
import createStreamOutput from "../../../../src/conductor/commands/logged/stream-output.mjs";

test("routes visible output and suppresses quiet output", () => {
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  try {
    const handlers = createStreamOutput();
    handlers.onStdout("out");
    handlers.onStderr("err");
    createStreamOutput({ quiet: true }).onStdout("hidden");
    createStreamOutput({ logPath: "/log" }).onStderr("hidden");
    expect(stdout).toHaveBeenCalledWith("out");
    expect(stderr).toHaveBeenCalledWith("err");
    expect(stdout).toHaveBeenCalledTimes(1);
    expect(stderr).toHaveBeenCalledTimes(1);
  } finally {
    stdout.mockRestore();
    stderr.mockRestore();
  }
});
