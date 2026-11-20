import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: writeCommandLog } = await import("../../../src/conductor/commands/log.mjs");

test("writes command output to a nested log file", async () => {
  const file = "/virtual/logs/run-1/build.log";
  const result = await writeCommandLog({
    file,
    name: "build-rpm",
    stdout: "build output",
    stderr: "build warning",
  });
  const contents = await fs.readFile(file, "utf8");
  expect(contents).toContain("Command: build-rpm");
  expect(contents).toContain("build output");
  expect(contents).toContain("build warning");
  expect(result).toEqual({ stdout: "build output", stderr: "build warning" });
});

test("writes empty streams when a command produced no output", async () => {
  await writeCommandLog({ file: "/virtual/logs/empty.log", name: "check" });
  await expect(fs.readFile("/virtual/logs/empty.log", "utf8")).resolves.toContain("--- stderr ---");
});
