import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: updateReleaseCatalog } =
  await import("../../../src/publish/update-release/catalog.mjs");

test("updates package information in the latest and retained releases", async () => {
  const root = "/virtual/release-catalog";
  const catalogPath = path.join(root, "metadata/catalog.json");
  await fs.mkdir(path.dirname(catalogPath), { recursive: true });
  await fs.writeFile(
    catalogPath,
    JSON.stringify({ stable: { latest: { package: {} }, items: [{ package: {} }] } }),
  );
  const files = {
    writeJson: jest.fn(async (file, value) => fs.writeFile(file, JSON.stringify(value))),
  };
  await updateReleaseCatalog({
    stagingRoot: root,
    rpmSha256: "c".repeat(64),
    rpmSize: 50,
    files,
  });
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  expect(catalog.stable.latest.package).toEqual({ sha256: "c".repeat(64), size: 50 });
  expect(catalog.stable.items[0].package).toEqual({ sha256: "c".repeat(64), size: 50 });
});
