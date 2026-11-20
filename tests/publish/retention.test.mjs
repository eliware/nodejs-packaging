import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: pruneGenerations } = await import("../../src/publish/retention.mjs");

test("keeps the active generation and does not prune staging directories", async () => {
  const root = "/virtual/retention";
  await fs.mkdir(`${root}/.generations`, { recursive: true });
  for (const name of ["active", "retired", ".staging-test"])
    await fs.mkdir(`${root}/.generations/${name}`);
  await expect(pruneGenerations(root, "active", 0)).resolves.toEqual(["active"]);
  await expect(fs.readdir(`${root}/.generations`)).resolves.toEqual(
    expect.arrayContaining([".staging-test", "active"]),
  );
});
