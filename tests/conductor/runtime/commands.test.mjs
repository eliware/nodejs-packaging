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
