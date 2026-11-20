import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: writeRedactedCommandOutput } =
  await import("../../../../src/conductor/commands/logged/output.mjs");

test("redacts output before writing a command log", async () => {
  const file = "/virtual/logs/safe-output.log";
  const safe = await writeRedactedCommandOutput({
    file,
    name: "build",
    stdout: "secret-output",
    stderr: "secret-error",
    env: { API_KEY: "secret-output", WEBHOOK_TOKEN: "secret-error" },
  });
  expect(safe.stdout).not.toContain("secret-output");
  expect(safe.stderr).not.toContain("secret-error");
  const contents = await fs.readFile(file, "utf8");
  expect(contents).toContain(safe.stdout);
  expect(contents).toContain(safe.stderr);
  expect(contents).not.toContain("secret-output");
  expect(contents).not.toContain("secret-error");
});

test("writes empty output with the process environment by default", async () => {
  await expect(
    writeRedactedCommandOutput({ file: "/virtual/logs/empty.log", name: "empty" }),
  ).resolves.toEqual({ stdout: "", stderr: "" });
});
