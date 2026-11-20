import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: loadReleaseKeyConfig } = await import("../../src/prepare/key-config.mjs");

test("loads the configured Node.js signing key list", async () => {
  const root = "/virtual/prepare-key-config";
  await fs.mkdir(path.join(root, "build-config"), { recursive: true });
  await fs.writeFile(
    path.join(root, "build-config/nodejs-release-keys.json"),
    JSON.stringify({ fingerprints: ["A".repeat(40)] }),
  );
  await expect(loadReleaseKeyConfig(root)).resolves.toEqual({
    fingerprints: ["A".repeat(40)],
  });
});
