import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: releaseGenerationModule } =
  await import("../../src/publish/release-generation.mjs");
const { prepareReleaseGeneration } = releaseGenerationModule();

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
    sign: jest.fn(async () => {}),
    listFiles: jest.fn(async () => [{ path: rpmName }]),
    buildIndex: jest.fn(async () => ({ "/": { entries: [] } })),
  };
  await fs.mkdir(path.join(stablePath, "repodata"), { recursive: true });
  await fs.mkdir(path.join(metadata, "releases"), { recursive: true });
  await fs.mkdir(path.join(metadata, "provenance"), { recursive: true });
  await fs.writeFile(path.join(stablePath, rpmName), "rpm");
  await fs.writeFile(path.join(stablePath, "repodata/repomd.xml"), "repomd");
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
  expect(files.sign).toHaveBeenCalledTimes(3);
  expect(
    JSON.parse(await fs.readFile(path.join(metadata, "catalog.json"), "utf8")).stable.latest
      .package,
  ).toEqual(expect.objectContaining({ sha256: "a".repeat(64) }));
  expect(
    JSON.parse(await fs.readFile(path.join(metadata, "release-manifest.json"), "utf8")),
  ).toEqual(expect.objectContaining({ signed: true, publication_ready: true }));
});
