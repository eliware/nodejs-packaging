import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const spawnSync = jest.fn();
const prepareReleaseGeneration = jest.fn();
const files = {
  exists: async (name) => {
    try {
      await fs.stat(name);
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  },
  atomicCopy: (source, destination) => fs.cp(source, destination),
  replacePointer: async (pointer, target) => {
    await fs.mkdir(path.dirname(pointer), { recursive: true });
    await fs.rm(pointer, { recursive: true, force: true });
    await fs.symlink(path.relative(path.dirname(pointer), target), pointer);
  },
};
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:child_process", () => ({ spawnSync }));
jest.unstable_mockModule("../../src/publish/filesystem.mjs", () => ({ default: () => files }));
jest.unstable_mockModule("../../src/publish/release-generation.mjs", () => ({
  default: () => ({ prepareReleaseGeneration }),
}));
const { default: publishModule } = await import("../../src/publish/release.mjs");
const { main } = publishModule();
const fingerprint = "A".repeat(40);

async function setup() {
  const candidate = path.resolve("/virtual/candidate");
  const root = path.resolve("/virtual/repository");
  const generation = "node-v26.13.1-el10-x86_64-20261119120000";
  await fs.rm(candidate, { recursive: true, force: true });
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(path.join(root, "metadata"), { recursive: true });
  await fs.mkdir(path.join(candidate, "metadata"), { recursive: true });
  await fs.mkdir(path.join(candidate, "el10/x86_64/stable"), { recursive: true });
  await fs.mkdir(path.join(candidate, "keys"), { recursive: true });
  await fs.mkdir(path.join(candidate, "metadata/provenance"), { recursive: true });
  await fs.mkdir(path.join(candidate, "metadata/releases"), { recursive: true });
  await fs.mkdir(path.join(candidate, "metadata/validation"), { recursive: true });
  await fs.writeFile(
    path.join(candidate, "metadata/release-manifest.json"),
    JSON.stringify({ generation_id: generation }),
  );
  await fs.writeFile(path.join(candidate, "metadata/release-manifest.json.asc"), "signature");
  await fs.writeFile(path.join(candidate, "metadata/active-generation.json"), "{}");
  await fs.writeFile(path.join(candidate, "metadata/catalog.json"), "{}");
  await fs.writeFile(path.join(candidate, "metadata/repository-index.json"), "{}");
  await fs.writeFile(path.join(candidate, "metadata/provenance/package.json"), "{}");
  await fs.writeFile(path.join(candidate, "metadata/releases/nodejs26.json"), "{}");
  await fs.writeFile(path.join(candidate, "metadata/validation/package.json"), "{}");
  await fs.writeFile(path.join(candidate, "nodejs26.repo"), "[nodejs26]");
  await fs.writeFile(path.join(candidate, "keys/RPM-GPG-KEY-ELIWARE-NODEJS"), "key");
  await fs.writeFile(path.join(candidate, "el10/x86_64/stable/node.rpm"), "rpm");
  process.env.NODEJS_SIGNING_KEY = fingerprint;
  delete process.env.NODEJS_REPOSITORY_ROOT;
  delete process.env.NODEJS_GNUPGHOME;
  prepareReleaseGeneration.mockReset().mockResolvedValue({ rpmSha256: "b".repeat(64) });
  spawnSync.mockReset();
  return { candidate, root, generation };
}

function runWithEnv(candidate, root) {
  process.env.NODEJS_REPOSITORY_ROOT = root;
  return main(["--version", "26.13.1", "--candidate", candidate, "--repository", root]);
}

test("validates release version, candidate path, and signing key", async () => {
  await setup();
  await expect(main()).rejects.toThrow("pass a stable Node.js 26 version with --version");
  await expect(main(["--version", "27.0.0", "--candidate", "/virtual/candidate"])).rejects.toThrow(
    "pass a stable Node.js 26 version with --version",
  );
  await expect(main(["--version", "26.13.1"])).rejects.toThrow(
    "pass a repository candidate with --candidate",
  );
  delete process.env.NODEJS_SIGNING_KEY;
  await expect(main(["--version", "26.13.1", "--candidate", "/virtual/candidate"])).rejects.toThrow(
    "set NODEJS_SIGNING_KEY to the signing key fingerprint",
  );
});

test("publishes a signed generation and updates repository pointers", async () => {
  const { candidate, root, generation } = await setup();
  const output = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  prepareReleaseGeneration.mockImplementation(async ({ run }) => {
    expect(run("gpg", ["--version"])).toEqual(expect.objectContaining({ status: 0 }));
    return { rpmSha256: "b".repeat(64) };
  });
  spawnSync.mockReturnValue({ status: 0, stdout: "ok", stderr: "" });
  try {
    await main(["--version", "26.13.1", "ignored", "--candidate", candidate, "--repository", root]);
    const stable = await fs.lstat(path.join(root, "el10/x86_64/stable"));
    expect(stable.isSymbolicLink()).toBe(true);
    expect(await fs.readFile(path.join(root, "nodejs26.repo"), "utf8")).toBe("[nodejs26]");
    expect(await fs.readFile(path.join(root, "metadata/active-generation.json"), "utf8")).toBe(
      "{}",
    );
    expect(prepareReleaseGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: generation,
        rpmName: "node.rpm",
        keyFingerprint: fingerprint,
        gpgHome: path.resolve("/var/lib/eliware/nodejs-signing/gnupg"),
      }),
    );
    expect(output).toHaveBeenCalled();
  } finally {
    output.mockRestore();
    delete process.env.NODEJS_SIGNING_KEY;
    delete process.env.NODEJS_REPOSITORY_ROOT;
  }
});

test("rejects malformed candidates, duplicate releases, and Git tool errors", async () => {
  const { candidate, root } = await setup();
  await fs.writeFile(path.join(candidate, "metadata/release-manifest.json"), "{}");
  await expect(runWithEnv(candidate, root)).rejects.toThrow(
    "candidate has an invalid generation identifier",
  );

  const valid = await setup();
  await fs.writeFile(path.join(valid.candidate, "el10/x86_64/stable/second.rpm"), "rpm");
  await expect(runWithEnv(valid.candidate, valid.root)).rejects.toThrow(
    "expected one RPM in candidate, found 2",
  );

  const duplicate = await setup();
  await fs.mkdir(path.join(duplicate.root, ".generations", duplicate.generation), {
    recursive: true,
  });
  await expect(runWithEnv(duplicate.candidate, duplicate.root)).rejects.toThrow(
    "generation already exists",
  );

  const failed = await setup();
  prepareReleaseGeneration.mockImplementation(async ({ run }) => {
    run("gpg", ["--version"]);
  });
  spawnSync.mockReturnValue({ status: 3, stderr: "gpg failed" });
  await expect(runWithEnv(failed.candidate, failed.root)).rejects.toThrow(
    "gpg exited with status 3: gpg failed",
  );

  const missing = await setup();
  prepareReleaseGeneration.mockImplementation(async ({ run }) => {
    run("gpg", ["--version"]);
  });
  spawnSync.mockReturnValue({ error: new Error("gpg missing") });
  await expect(runWithEnv(missing.candidate, missing.root)).rejects.toThrow("gpg missing");
  delete process.env.NODEJS_SIGNING_KEY;
  delete process.env.NODEJS_REPOSITORY_ROOT;
});

test("removes an empty stable pointer before replacing it", async () => {
  const { candidate, root } = await setup();
  const stable = path.join(root, "el10/x86_64/stable");
  await fs.mkdir(stable, { recursive: true });
  const output = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    await runWithEnv(candidate, root);
    expect((await fs.lstat(stable)).isSymbolicLink()).toBe(true);
  } finally {
    output.mockRestore();
    delete process.env.NODEJS_SIGNING_KEY;
    delete process.env.NODEJS_REPOSITORY_ROOT;
  }
});

test("replaces an existing file metadata pointer", async () => {
  const { candidate, root } = await setup();
  await fs.writeFile(path.join(root, "metadata/provenance"), "old pointer");
  const output = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    await runWithEnv(candidate, root);
    expect((await fs.lstat(path.join(root, "metadata/provenance"))).isSymbolicLink()).toBe(true);
  } finally {
    output.mockRestore();
    delete process.env.NODEJS_SIGNING_KEY;
    delete process.env.NODEJS_REPOSITORY_ROOT;
  }
});

test("rejects non-empty stable and metadata paths", async () => {
  const stableCase = await setup();
  const stablePath = path.join(stableCase.root, "el10/x86_64/stable");
  await fs.mkdir(stablePath, { recursive: true });
  await fs.writeFile(path.join(stablePath, "old.rpm"), "old rpm");
  await expect(runWithEnv(stableCase.candidate, stableCase.root)).rejects.toThrow(
    "stable repository path is not empty",
  );

  const metadataCase = await setup();
  const metadataPath = path.join(metadataCase.root, "metadata/validation");
  await fs.mkdir(metadataPath, { recursive: true });
  await fs.writeFile(path.join(metadataPath, "old.json"), "old record");
  await expect(runWithEnv(metadataCase.candidate, metadataCase.root)).rejects.toThrow(
    `metadata path is not empty: ${metadataPath}`,
  );
  delete process.env.NODEJS_SIGNING_KEY;
  delete process.env.NODEJS_REPOSITORY_ROOT;
});
