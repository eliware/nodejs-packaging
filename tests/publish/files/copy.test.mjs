import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: atomicCopy } = await import("../../../src/publish/files/copy.mjs");

test("copies a file through a temporary path", async () => {
  const root = "/virtual/publish-copy";
  await fs.mkdir(root, { recursive: true });
  const source = path.join(root, "source");
  const destination = path.join(root, "destination");
  await fs.writeFile(source, "data");
  await atomicCopy(source, destination);
  await expect(fs.readFile(destination, "utf8")).resolves.toBe("data");
});
