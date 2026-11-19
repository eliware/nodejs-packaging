import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";

const spawn = jest.fn();
jest.unstable_mockModule("node:child_process", () => ({ spawn }));
const { default: commandRunModule } = await import("../../../src/conductor/commands/run.mjs");
const { runCommand } = commandRunModule();

function childWith(event, ...values) {
  const child = new EventEmitter();
  process.nextTick(() => child.emit(event, ...values));
  return child;
}

test("runs commands with inherited streams and explicit settings", async () => {
  spawn.mockImplementationOnce(() => childWith("exit", 0, null));
  await expect(runCommand("node", ["script.mjs"], { env: {}, cwd: "/virtual" })).resolves.toEqual({
    code: 0,
  });
  expect(spawn).toHaveBeenCalledWith("node", ["script.mjs"], {
    cwd: "/virtual",
    env: {},
    stdio: "inherit",
  });
});

test("reports command exit, signal, and spawn failures", async () => {
  spawn.mockImplementationOnce(() => childWith("exit", 7, null));
  await expect(runCommand("node", [])).rejects.toThrow("node exited with code 7 ");
  spawn.mockImplementationOnce(() => childWith("exit", null, "SIGTERM"));
  await expect(runCommand("node", [])).rejects.toThrow("node exited with code signal SIGTERM");
  spawn.mockImplementationOnce(() => childWith("error", new Error("spawn failed")));
  await expect(runCommand("node", [])).rejects.toThrow("spawn failed");
});
