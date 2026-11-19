import { EventEmitter } from "node:events";
import { expect, jest, test } from "@jest/globals";

const spawn = jest.fn();
jest.unstable_mockModule("node:child_process", () => ({ spawn }));
const { default: conductorRunnerModule } =
  await import("../../../src/conductor/service/runner.mjs");
const { runConductor } = conductorRunnerModule();

function childWith(event, ...values) {
  const child = new EventEmitter();
  process.nextTick(() => child.emit(event, ...values));
  return child;
}

test("spawns the conductor with the process environment", async () => {
  spawn.mockReset().mockImplementation(() => childWith("exit", 0, null));
  await expect(
    runConductor("--dry-run", { root: "/workspace", conductor: "/workspace/bin/conductor.mjs" }),
  ).resolves.toBeUndefined();
  expect(spawn).toHaveBeenCalledWith(
    process.execPath,
    ["/workspace/bin/conductor.mjs", "--dry-run"],
    {
      cwd: "/workspace",
      env: { ...process.env, NODEJS_CONDUCTOR_SERVICE: "true" },
      stdio: "inherit",
    },
  );
});

test("reports failed exit codes, signals, and spawn errors", async () => {
  spawn.mockReset().mockImplementation(() => childWith("exit", 7, null));
  await expect(
    runConductor("--dry-run", { root: "/root", conductor: "/root/bin.mjs" }),
  ).rejects.toThrow("conductor exited with code 7 ");
  spawn.mockReset().mockImplementation(() => childWith("exit", null, "SIGTERM"));
  await expect(
    runConductor("--wet-run", { root: "/root", conductor: "/root/bin.mjs" }),
  ).rejects.toThrow("conductor exited with code signal SIGTERM");
  spawn.mockReset().mockImplementation(() => childWith("error", new Error("spawn failed")));
  await expect(
    runConductor("--dry-run", { root: "/root", conductor: "/root/bin.mjs" }),
  ).rejects.toThrow("spawn failed");
});
