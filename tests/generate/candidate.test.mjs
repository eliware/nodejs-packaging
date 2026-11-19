import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const spawnSync = jest.fn();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:fs", () => ({ createReadStream: fs.createReadStream }));
jest.unstable_mockModule("node:child_process", () => ({ spawnSync }));
const { default: generateCandidateModule } = await import("../../src/generate/candidate.mjs");
const { generateCandidate } = generateCandidateModule();

async function setup(outputRoot) {
  const root = "/virtual/candidate-source";
  const packageDir = "/virtual/candidate-package";
  const rpmPath = path.join(packageDir, "node.rpm");
  await fs.mkdir(path.join(root, "templates"), { recursive: true });
  await fs.writeFile(path.join(root, "templates/nodejs26.repo"), "[nodejs26]\n");
  await fs.writeFile(
    path.join(root, "templates/catalog.seed.json"),
    JSON.stringify({ metadata_version: "0.1.0", stable: { items: [] } }),
  );
  await fs.mkdir(packageDir, { recursive: true });
  await fs.writeFile(rpmPath, "rpm bytes");
  spawnSync.mockReset().mockImplementation((command, args) => {
    const rpmDirectory = args.at(-1);
    fs.mkdirSync(path.join(rpmDirectory, "repodata"), { recursive: true });
    fs.writeFileSync(path.join(rpmDirectory, "repodata/repomd.xml"), "metadata");
    return { status: 0, stderr: "" };
  });
  return {
    root,
    outputRoot,
    rpmPath,
    rpmRecord: {
      path: "node.rpm",
      name: "eliware-node26",
      version: "26.13.1",
      npm_version: "12.2.3",
    },
  };
}

test("stages a complete repository candidate and publishes it atomically", async () => {
  const input = await setup("/virtual/candidate-output/generation-1");
  const result = await generateCandidate({
    ...input,
    version: "26.13.1",
    generationId: "generation-1",
    sourceInput: { source: { sha256: "a".repeat(64) }, npm: { version: "12.2.3" } },
    now: new Date("2026-11-19T12:00:00.000Z"),
  });
  expect(result).toEqual(
    expect.objectContaining({
      output: input.outputRoot,
      generation_id: "generation-1",
      rpm: expect.objectContaining({ path: "el10/x86_64/stable/node.rpm", size: 9 }),
    }),
  );
  expect(
    JSON.parse(
      await fs.readFile(path.join(input.outputRoot, "metadata/release-manifest.json"), "utf8"),
    ),
  ).toEqual(expect.objectContaining({ publication_ready: false, generation_id: "generation-1" }));
  expect(
    await fs.readFile(path.join(input.outputRoot, "el10/x86_64/stable/SHA256SUMS"), "utf8"),
  ).toContain("node.rpm");
});

test("cleans the staging directory when repository metadata generation fails", async () => {
  const input = await setup("/virtual/candidate-failed/generation-1");
  spawnSync.mockReturnValue({ status: 1, stderr: "createrepo failed" });
  await expect(
    generateCandidate({
      ...input,
      version: "26.13.1",
      generationId: "generation-1",
      sourceInput: { source: { sha256: "a".repeat(64) }, npm: { version: "12.2.3" } },
      now: new Date("2026-11-19T12:00:00.000Z"),
    }),
  ).rejects.toThrow("createrepo_c exited with status 1: createrepo failed");
  await expect(fs.readdir("/virtual/candidate-failed")).resolves.toEqual([]);
});
