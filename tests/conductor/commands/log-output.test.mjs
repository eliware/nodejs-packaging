import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: logCommandOutput } =
  await import("../../../src/conductor/commands/log-output.mjs");

test("redacts and persists command output before returning safe streams", async () => {
  const file = "/virtual/logs/redacted.log";
  const result = await logCommandOutput({
    file,
    name: "run",
    stdout: "private-output",
    stderr: "private-error",
    env: { API_KEY: "private-output", WEBHOOK_TOKEN: "private-error" },
  });
  expect(result.stdout).not.toContain("private-output");
  expect(result.stderr).not.toContain("private-error");
  const content = await fs.readFile(file, "utf8");
  expect(content).toContain(result.stdout);
  expect(content).toContain(result.stderr);
  expect(content).not.toContain("private-output");
  expect(content).not.toContain("private-error");
});

test("writes empty output with the process environment by default", async () => {
  await expect(
    logCommandOutput({ file: "/virtual/logs/empty-output.log", name: "empty" }),
  ).resolves.toEqual({ stdout: "", stderr: "" });
});
