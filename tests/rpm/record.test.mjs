import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:fs", () => ({ createReadStream: fs.createReadStream }));
const { default: writePackageRecord } = await import("../../src/rpm/record.mjs");

test("validates package metadata and writes an RPM record", async () => {
  const rpmFile = "/virtual/rpm-record/eliware-node26.rpm";
  const outputDir = "/virtual/rpm-record/output";
  await fs.mkdir("/virtual/rpm-record", { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(rpmFile, "rpm bytes");
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    const record = await writePackageRecord({
      rpmFile,
      outputDir,
      packageInfo: ["eliware-node26", "(none)", "26.13.1", "1", "x86_64"],
      version: "26.13.1",
      npmVersion: "12.2.3",
    });
    expect(record).toEqual(
      expect.objectContaining({
        name: "eliware-node26",
        epoch: null,
        version: "26.13.1",
        architecture: "x86_64",
        npm_version: "12.2.3",
        path: "eliware-node26.rpm",
        size: 9,
        sha256: expect.any(String),
      }),
    );
    expect(JSON.parse(await fs.readFile(`${outputDir}/package.json`, "utf8"))).toEqual(record);
    expect(stdout).toHaveBeenCalled();
  } finally {
    stdout.mockRestore();
  }
});

test("rejects package metadata for another version or architecture", async () => {
  for (const packageInfo of [
    ["wrong", "(none)", "26.13.1", "1", "x86_64"],
    ["eliware-node26", "(none)", "25.0.0", "1", "x86_64"],
    ["eliware-node26", "(none)", "26.13.1", "1", "aarch64"],
  ])
    await expect(
      writePackageRecord({
        rpmFile: "/missing.rpm",
        outputDir: "/missing",
        packageInfo,
        version: "26.13.1",
        npmVersion: "12.2.3",
      }),
    ).rejects.toThrow("built RPM metadata does not match target");
});
