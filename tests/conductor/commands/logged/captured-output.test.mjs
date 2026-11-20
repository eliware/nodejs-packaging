import { expect, jest, test } from "@jest/globals";

const writeRedactedCommandOutput = jest.fn(async () => ({
  stdout: "safe out",
  stderr: "safe err",
}));
jest.unstable_mockModule("../../../../src/conductor/commands/logged/output.mjs", () => ({
  default: writeRedactedCommandOutput,
}));
const { default: logCapturedOutput } =
  await import("../../../../src/conductor/commands/logged/captured-output.mjs");

test("writes safe output and echoes it when the capture is visible", async () => {
  const output = { stdout: { write: jest.fn() }, stderr: { write: jest.fn() } };
  await expect(
    logCapturedOutput({ file: "/logs/build.log", name: "build", output }),
  ).resolves.toEqual({ stdout: "safe out", stderr: "safe err" });
  expect(writeRedactedCommandOutput).toHaveBeenCalledWith({
    file: "/logs/build.log",
    name: "build",
    stdout: "",
    stderr: "",
    env: undefined,
  });
  expect(output.stdout.write).toHaveBeenCalledWith("safe out");
  expect(output.stderr.write).toHaveBeenCalledWith("safe err");
});

test("does not echo quiet command output", async () => {
  const output = { stdout: { write: jest.fn() }, stderr: { write: jest.fn() } };
  await logCapturedOutput({
    file: "/logs/quiet.log",
    name: "quiet",
    stdout: "raw output",
    quiet: true,
    output,
  });
  expect(output.stdout.write).not.toHaveBeenCalled();
  expect(output.stderr.write).not.toHaveBeenCalled();
});
