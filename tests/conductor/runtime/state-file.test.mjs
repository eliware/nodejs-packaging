import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: saveConductorState } =
  await import("../../../src/conductor/runtime/state-file.mjs");

test("writes run state to a temporary file before replacing the current state", async () => {
  const root = "/virtual/state-file";
  await fs.mkdir(root, { recursive: true });
  await saveConductorState(root, { stage: "complete", run_id: "run-1" });
  const saved = JSON.parse(await fs.readFile(path.join(root, "last-run.json"), "utf8"));
  expect(saved).toEqual(
    expect.objectContaining({ stage: "complete", run_id: "run-1", updated: expect.any(String) }),
  );
  await expect(fs.stat(path.join(root, "last-run.json.tmp"))).rejects.toMatchObject({
    code: "ENOENT",
  });
});
