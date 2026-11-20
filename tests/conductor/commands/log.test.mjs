import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: writeCommandLog } = await import("../../../src/conductor/commands/log.mjs");

test("writes bounded command logs with shared secret redaction", async () => {
  const file = "/virtual/logs/run-1/build.log";
  await writeCommandLog({
    file,
    name: "build-rpm",
    stdout: "using secret-value and Authorization: Bearer sample-token api-token",
    stderr: "token=sample-token",
    env: { DISCORD_WEBHOOK: "secret-value", API_KEY: "api-token" },
  });
  const contents = await fs.readFile(file, "utf8");
  expect(contents).toContain("Command: build-rpm");
  expect(contents).not.toContain("secret-value");
  expect(contents).not.toContain("sample-token");
  expect(contents).not.toContain("api-token");
  expect(contents).toContain("[REDACTED]");
});

test("writes empty streams when a command produced no output", async () => {
  await writeCommandLog({ file: "/virtual/logs/empty.log", name: "check" });
  await expect(fs.readFile("/virtual/logs/empty.log", "utf8")).resolves.toContain("--- stderr ---");
});
