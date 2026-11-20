import { expect, jest, test } from "@jest/globals";
import conductorCommands from "../../../src/conductor/runtime/commands.mjs";

test("runs Node.js commands with default and explicit arguments", async () => {
  const runCommand = jest.fn(async () => ({ code: 0 }));
  const runCommandCapture = jest.fn(async () => ({ code: 0, stdout: "output", stderr: "" }));
  const commands = conductorCommands({
    root: "/workspace",
    commands: { runCommand, runCommandCapture },
  });
  await commands.runNode("bin/example.mjs");
  await commands.runNode("bin/example.mjs", ["--version"], { EXTRA: "yes" });
  await expect(commands.runNodeCapture("bin/example.mjs")).resolves.toEqual({
    code: 0,
    stdout: "output",
    stderr: "",
  });
  await commands.runNodeCapture("bin/example.mjs", ["--version"]);
  expect(runCommand).toHaveBeenNthCalledWith(
    1,
    process.execPath,
    ["/workspace/bin/example.mjs"],
    expect.objectContaining({ cwd: "/workspace", env: expect.any(Object) }),
  );
  expect(runCommandCapture).toHaveBeenCalledWith(
    process.execPath,
    ["/workspace/bin/example.mjs", "--version"],
    { cwd: "/workspace" },
  );
});

test("adds per-run log paths when the conductor supplies a run identifier", async () => {
  const runNode = jest.fn();
  const runNodeCapture = jest.fn();
  const commands = { runCommand: runNode, runCommandCapture: runNodeCapture };
  const { runNode: execute, runNodeCapture: executeCapture } = conductorCommands({
    root: "/workspace",
    runId: "run-7",
    commands,
  });
  await execute("bin/build-rpm.mjs");
  expect(runNode).toHaveBeenCalledWith(
    process.execPath,
    ["/workspace/bin/build-rpm.mjs"],
    expect.objectContaining({
      logPath: "/workspace/artifacts/logs/run-7/001-build-rpm.log",
      env: expect.objectContaining({ NODEJS_CONDUCTOR_RUN_ID: "run-7" }),
    }),
  );
  await executeCapture("bin/generate-repository.mjs");
  expect(runNodeCapture).toHaveBeenCalledWith(
    process.execPath,
    ["/workspace/bin/generate-repository.mjs"],
    expect.objectContaining({
      logPath: "/workspace/artifacts/logs/run-7/002-generate-repository.log",
      env: expect.objectContaining({ NODEJS_CONDUCTOR_RUN_ID: "run-7" }),
    }),
  );
});
