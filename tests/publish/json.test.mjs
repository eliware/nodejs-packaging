import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: writeJson } = await import("../../src/publish/json.mjs");

test("writes formatted JSON with a final newline", async () => {
  const file = "/virtual/publish-json/metadata.json";
  await fs.mkdir("/virtual/publish-json", { recursive: true });
  await writeJson(file, { version: 1 });
  await expect(fs.readFile(file, "utf8")).resolves.toBe('{\n  "version": 1\n}\n');
});
