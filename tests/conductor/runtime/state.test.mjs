import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: runtimeStateModule } = await import("../../../src/conductor/runtime/state.mjs");
const { conductorState } = runtimeStateModule();

test("creates and removes a lock and saves state atomically", async () => {
  const stateRoot = "/virtual/conductor-state";
  const state = conductorState({ stateRoot, runId: "run-1" });
  const lockPath = path.join(stateRoot, "lock");
  await expect(state.acquireLock(lockPath)).resolves.toBe(true);
  const owner = JSON.parse(await fs.readFile(path.join(lockPath, "owner.json"), "utf8"));
  expect(owner).toEqual(expect.objectContaining({ run_id: "run-1", pid: process.pid }));
  await state.saveState({ stage: "complete" });
  const saved = JSON.parse(await fs.readFile(path.join(stateRoot, "last-run.json"), "utf8"));
  expect(saved).toEqual(
    expect.objectContaining({ stage: "complete", updated: expect.any(String) }),
  );
  await state.releaseLock(lockPath);
  await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
});

test("recovers a stale lock and keeps a lock held by a live process", async () => {
  const stateRoot = "/virtual/conductor-stale-state";
  const lockPath = path.join(stateRoot, "lock");
  const state = conductorState({ stateRoot, runId: "run-2" });
  await fs.mkdir(lockPath, { recursive: true });
  await fs.writeFile(path.join(lockPath, "owner.json"), JSON.stringify({ pid: 12345 }));
  const kill = jest.spyOn(process, "kill").mockImplementation(() => {
    throw Object.assign(new Error("process not found"), { code: "ESRCH" });
  });
  try {
    await expect(state.acquireLock(lockPath)).resolves.toBe(true);
    expect(JSON.parse(await fs.readFile(path.join(lockPath, "owner.json"), "utf8"))).toMatchObject({
      run_id: "run-2",
    });
  } finally {
    kill.mockRestore();
  }

  await fs.rm(lockPath, { recursive: true, force: true });
  await fs.mkdir(lockPath, { recursive: true });
  await fs.writeFile(path.join(lockPath, "owner.json"), JSON.stringify({ pid: process.pid }));
  await expect(state.acquireLock(lockPath)).rejects.toThrow("conductor lock is held");
});

test("recovers a stale lock directory with no owner record", async () => {
  const stateRoot = "/virtual/conductor-ownerless-state";
  const lockPath = path.join(stateRoot, "lock");
  const state = conductorState({ stateRoot, runId: "run-3" });
  await fs.mkdir(lockPath, { recursive: true });
  await expect(state.acquireLock(lockPath)).resolves.toBe(true);
  await expect(fs.readFile(path.join(lockPath, "owner.json"), "utf8")).resolves.toContain("run-3");
});

test("reports lock errors that do not indicate stale owners", async () => {
  const stateRoot = "/virtual/conductor-lock-errors";
  const lockPath = path.join(stateRoot, "lock");
  await fs.mkdir(lockPath, { recursive: true });
  await fs.writeFile(path.join(lockPath, "owner.json"), JSON.stringify({ pid: 12345 }));
  const unreadableState = conductorState({
    stateRoot,
    runId: "run-4",
    readOwner: async () => {
      throw Object.assign(new Error("denied"), { code: "EACCES" });
    },
  });
  await expect(unreadableState.acquireLock(lockPath)).rejects.toThrow("denied");

  const processErrorState = conductorState({
    stateRoot,
    runId: "run-4",
    isProcessAlive: async () => {
      throw Object.assign(new Error("permission denied"), { code: "EPERM" });
    },
  });
  await expect(processErrorState.acquireLock(lockPath)).rejects.toThrow("permission denied");
});

test("propagates lock creation errors unrelated to an existing lock", async () => {
  const stateRoot = "/virtual/conductor-mkdir-error";
  const lockPath = path.join(stateRoot, "lock");
  const state = conductorState({
    stateRoot,
    runId: "run-5",
    createDirectory: async (target, options) => {
      if (target === lockPath) throw Object.assign(new Error("denied"), { code: "EACCES" });
      return fs.mkdir(target, options);
    },
  });
  await expect(state.acquireLock(lockPath)).rejects.toThrow("denied");
});

test("propagates invalid lock owner process identifiers", async () => {
  const stateRoot = "/virtual/conductor-invalid-owner";
  const lockPath = path.join(stateRoot, "lock");
  const state = conductorState({ stateRoot, runId: "run-6" });
  await fs.mkdir(lockPath, { recursive: true });
  await fs.writeFile(path.join(lockPath, "owner.json"), JSON.stringify({ pid: "invalid" }));
  await expect(state.acquireLock(lockPath)).rejects.toThrow();
});
