import { expect, jest, test } from "@jest/globals";
import captureOutput from "../../../../src/conductor/commands/logged/capture-output.mjs";

test("echoes output when no log is configured", async () => {
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  try {
    const handlers = captureOutput();
    handlers.onStdout("out");
    handlers.onStderr("err");
    await handlers.onExit({ code: 0, stdout: "out", stderr: "err" });
    expect(stdout).toHaveBeenCalledWith("out");
    expect(stderr).toHaveBeenCalledWith("err");
  } finally {
    stdout.mockRestore();
    stderr.mockRestore();
  }
});

test("suppresses quiet output and formats logged command failures", async () => {
  const handlers = captureOutput({ quiet: true });
  await handlers.onExit({ code: 1, stdout: "out", stderr: "err" });
});
