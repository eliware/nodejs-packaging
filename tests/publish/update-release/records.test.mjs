import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: updateReleaseRecords } =
  await import("../../../src/publish/update-release/records.mjs");

test("updates package hashes in release and provenance records", async () => {
  const root = "/virtual/release-records";
  const releasePath = path.join(root, "metadata/releases/nodejs26.json");
  const provenancePath = path.join(root, "metadata/provenance/package.json");
  await fs.mkdir(path.dirname(releasePath), { recursive: true });
  await fs.mkdir(path.dirname(provenancePath), { recursive: true });
  await fs.writeFile(releasePath, JSON.stringify({ package: {} }));
  await fs.writeFile(provenancePath, JSON.stringify({ package: {} }));
  const files = {
    writeJson: jest.fn(async (file, value) => fs.writeFile(file, JSON.stringify(value))),
  };
  await expect(
    updateReleaseRecords({
      stagingRoot: root,
      rpmSha256: "a".repeat(64),
      rpmSize: 42,
      files,
    }),
  ).resolves.toEqual({ provenancePath });
  expect(JSON.parse(await fs.readFile(releasePath, "utf8")).package).toEqual({
    sha256: "a".repeat(64),
    size: 42,
  });
  expect(JSON.parse(await fs.readFile(provenancePath, "utf8")).package).toEqual({
    sha256: "a".repeat(64),
    size: 42,
  });
});
