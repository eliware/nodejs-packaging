import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const sign = jest.fn(async () => {});
const buildIndex = jest.fn(async () => ({ "/": { entries: [] } }));
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("../../src/publish/sign.mjs", () => ({ default: sign }));
jest.unstable_mockModule("../../src/publish/validate-metadata.mjs", () => ({
  default: jest.fn(async () => true),
}));
jest.unstable_mockModule("../../src/generate/index.mjs", () => ({ default: buildIndex }));
const { default: prepareReleaseGeneration } =
  await import("../../src/publish/release-generation.mjs");

test("signs RPM and repository metadata and completes release manifests", async () => {
  const stagingRoot = "/virtual/release-generation/stage";
  const stablePath = path.join(stagingRoot, "el10/x86_64/stable");
  const metadata = path.join(stagingRoot, "metadata");
  const rpmName = "eliware-node26-26.13.1.rpm";
  const run = jest.fn((command) => (command === "gpg" ? { stdout: "PUBLIC KEY" } : {}));
  const files = {
    hashFile: jest.fn(async () => "a".repeat(64)),
    writeJson: jest.fn(async (file, value) => {
      await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
    }),
    listFiles: jest.fn(async () => [
      { path: rpmName },
      { path: "metadata/logs/run-7/build-rpm.log", sha256: "f".repeat(64), size: 10 },
    ]),
  };
  await fs.mkdir(path.join(stablePath, "repodata"), { recursive: true });
  await fs.mkdir(path.join(metadata, "releases"), { recursive: true });
  await fs.mkdir(path.join(metadata, "provenance"), { recursive: true });
  await fs.writeFile(path.join(stablePath, rpmName), "rpm");
  await fs.writeFile(path.join(stablePath, "repodata/repomd.xml"), "repomd");
  await fs.mkdir(path.join(metadata, "logs/run-7"), { recursive: true });
  await fs.writeFile(path.join(metadata, "logs/run-7/build-rpm.log"), "redacted output");
  await fs.writeFile(
    path.join(metadata, "releases/nodejs26.json"),
    JSON.stringify({ package: {}, node_version: "26.13.1" }),
  );
  await fs.writeFile(
    path.join(metadata, "provenance/package.json"),
    JSON.stringify({ package: {} }),
  );
  await fs.writeFile(
    path.join(metadata, "catalog.json"),
    JSON.stringify({ stable: { latest: { package: {} }, items: [{ package: {} }] } }),
  );
  await fs.writeFile(path.join(metadata, "release-manifest.json"), JSON.stringify({ files: [] }));
  const result = await prepareReleaseGeneration({
    stagingRoot,
    rpmName,
    generationId: "generation-1",
    keyFingerprint: "F".repeat(40),
    gpgHome: "/keys",
    run,
    files,
  });
  expect(result.rpmSha256).toBe("a".repeat(64));
  expect(run).toHaveBeenCalledWith("rpmsign", expect.any(Array), expect.any(Object));
  expect(run).toHaveBeenCalledWith("createrepo_c", expect.any(Array));
  expect(run).toHaveBeenCalledWith("gpg", expect.any(Array), expect.any(Object));
  expect(sign).toHaveBeenCalledTimes(3);
  const manifest = JSON.parse(
    await fs.readFile(path.join(metadata, "release-manifest.json"), "utf8"),
  );
  expect(manifest.files).toContainEqual(
    expect.objectContaining({
      path: "metadata/logs/run-7/build-rpm.log",
      sha256: "f".repeat(64),
    }),
  );
  expect(
    JSON.parse(await fs.readFile(path.join(metadata, "catalog.json"), "utf8")).stable.latest
      .package,
  ).toEqual(expect.objectContaining({ sha256: "a".repeat(64) }));
  expect(
    JSON.parse(await fs.readFile(path.join(metadata, "release-manifest.json"), "utf8")),
  ).toEqual(expect.objectContaining({ signed: true, publication_ready: true }));
  expect(buildIndex).toHaveBeenCalledWith(stagingRoot, "/", "metadata/repository-index.json");
  expect(
    JSON.parse(await fs.readFile(path.join(metadata, "repository-index.json"), "utf8")),
  ).toEqual(expect.objectContaining({ metadata_version: "0.1.0", schema: 1 }));
});
