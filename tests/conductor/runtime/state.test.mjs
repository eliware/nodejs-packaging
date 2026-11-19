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
