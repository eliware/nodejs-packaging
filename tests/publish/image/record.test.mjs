import path from "node:path";
import { Readable } from "node:stream";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const spawnSync = jest.fn();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:fs", () => ({
  createReadStream: (file) =>
    Readable.from(
      (async function* () {
        yield await fs.readFile(file);
      })(),
    ),
}));
jest.unstable_mockModule("node:child_process", () => ({ spawnSync }));
const { default: main } = await import("../../../src/publish/image/record.mjs");
const { default: activateGeneration } =
  await import("../../../src/publish/activate-generation.mjs");
const fingerprint = "A".repeat(40);
const digest = `sha256:${"a".repeat(64)}`;

async function setup() {
  const root = "/virtual/image-repository";
  const oldRoot = path.join(root, ".generations/generation-1");
  const recordPath = "/virtual/image.json";
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(recordPath, { force: true });
  await fs.mkdir(path.join(root, "metadata"), { recursive: true });
  await fs.mkdir(path.join(oldRoot, "metadata/provenance"), { recursive: true });
  await fs.mkdir(path.join(oldRoot, "metadata/releases"), { recursive: true });
  await fs.mkdir(path.join(oldRoot, "metadata/validation"), { recursive: true });
  await fs.mkdir(path.join(oldRoot, "metadata"), { recursive: true });
  await fs.mkdir(path.join(oldRoot, "el10/x86_64/stable/repodata"), { recursive: true });
  await fs.writeFile(
    path.join(root, "metadata/active-generation.json"),
    JSON.stringify({ generation: "generation-1" }),
  );
  await fs.writeFile(
    path.join(oldRoot, "metadata/catalog.json"),
    JSON.stringify({
      stable: {
        latest: { node_version: "26.13.1" },
        items: [{ node_version: "26.13.1" }],
      },
    }),
  );
  await fs.writeFile(
    path.join(root, "metadata/catalog.json"),
    JSON.stringify({ stable: { latest: { node_version: "26.13.1" } } }),
  );
  await fs.writeFile(
    path.join(oldRoot, "metadata/release-manifest.json"),
    JSON.stringify({ generation_id: "generation-1", files: [] }),
  );
  await fs.writeFile(path.join(oldRoot, "metadata/release-manifest.json.asc"), "signature");
  await fs.writeFile(
    path.join(oldRoot, "metadata/provenance/package.json"),
    JSON.stringify({ node_version: "26.13.1" }),
  );
  await fs.writeFile(path.join(oldRoot, "metadata/provenance/package.json.asc"), "signature");
  await fs.writeFile(
    path.join(oldRoot, "metadata/releases/nodejs26.json"),
    JSON.stringify({ node_version: "26.13.1" }),
  );
  await fs.writeFile(path.join(oldRoot, "metadata/validation/package.json"), "{}");
  await fs.writeFile(path.join(oldRoot, "metadata/repository-index.json"), "{}");
  await fs.writeFile(path.join(oldRoot, "el10/x86_64/stable/repodata/repomd.xml"), "repodata");
  await fs.writeFile(
    recordPath,
    JSON.stringify({
      repository: "ghcr.io/eliware/centos10-node26",
      tag: "26.13.1",
      digest,
      base_image: "quay.io/centos/centos:stream10",
      base_image_digest: `quay.io/centos/centos@sha256:${"b".repeat(64)}`,
      rpm_sha256: "c".repeat(64),
      source_release: "26.13.1",
      source_sha256: "d".repeat(64),
      local_image_id: "sha256:local",
      repository_generation: "generation-1",
      published: true,
      validation: "passed",
    }),
  );
  process.env.NODEJS_REPOSITORY_ROOT = root;
  process.env.NODEJS_SIGNING_KEY = fingerprint;
  delete process.env.NODEJS_GNUPGHOME;
  spawnSync.mockReset().mockImplementation((command, args) => {
    if (args.includes("--detach-sign")) fs.writeFileSync(`${args.at(-1)}.asc`, "signed");
    return { status: 0, stdout: "", stderr: "" };
  });
  return { root, oldRoot, recordPath };
}

test("requires an image record path and a valid signing key", async () => {
  await setup();
  delete process.env.NODEJS_REPOSITORY_ROOT;
  const argv = process.argv;
  process.argv = [process.execPath, "image-record.mjs"];
  try {
    await expect(main()).rejects.toThrow("pass the published image record path");
  } finally {
    process.argv = argv;
  }
  process.env.NODEJS_REPOSITORY_ROOT = "/virtual/image-repository";
  await expect(main([])).rejects.toThrow("pass the published image record path");
  delete process.env.NODEJS_SIGNING_KEY;
  await expect(main(["/virtual/image.json"])).rejects.toThrow(
    "set NODEJS_SIGNING_KEY to the signing key fingerprint",
  );
});

test("publishes a validated image into a new signed repository generation", async () => {
  const { root, recordPath } = await setup();
  const oldLogDirectory = process.env.NODEJS_CONDUCTOR_LOG_DIR;
  const oldRunId = process.env.NODEJS_CONDUCTOR_RUN_ID;
  process.env.NODEJS_CONDUCTOR_LOG_DIR = "/virtual/conductor-logs/run-7";
  process.env.NODEJS_CONDUCTOR_RUN_ID = "run-7";
  await fs.mkdir(process.env.NODEJS_CONDUCTOR_LOG_DIR, { recursive: true });
  await fs.writeFile(
    path.join(process.env.NODEJS_CONDUCTOR_LOG_DIR, "build-image.log"),
    "image build output",
  );
  const output = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    await main([recordPath]);
    const catalog = JSON.parse(await fs.readFile(path.join(root, "metadata/catalog.json"), "utf8"));
    const report = JSON.parse(
      await fs.readFile(path.join(root, "metadata/validation/image.json"), "utf8"),
    );
    const active = JSON.parse(
      await fs.readFile(path.join(root, "metadata/active-generation.json"), "utf8"),
    );
    expect(catalog.images[0]).toEqual(expect.objectContaining({ node_version: "26.13.1", digest }));
    expect(report).toEqual(expect.objectContaining({ status: "passed", registry_push: "passed" }));
    expect(active.generation).toMatch(/^node-v26\.13\.1-el10-x86_64-\d+$/);
    await expect(
      fs.readFile(
        path.join(root, ".generations", active.generation, "metadata/logs/run-7/build-image.log"),
        "utf8",
      ),
    ).resolves.toBe("image build output");
    expect((await fs.lstat(path.join(root, "el10/x86_64/stable"))).isSymbolicLink()).toBe(true);
    expect(spawnSync).toHaveBeenCalledTimes(3);
    expect(output).toHaveBeenCalled();
  } finally {
    output.mockRestore();
    delete process.env.NODEJS_REPOSITORY_ROOT;
    delete process.env.NODEJS_SIGNING_KEY;
    if (oldLogDirectory === undefined) delete process.env.NODEJS_CONDUCTOR_LOG_DIR;
    else process.env.NODEJS_CONDUCTOR_LOG_DIR = oldLogDirectory;
    if (oldRunId === undefined) delete process.env.NODEJS_CONDUCTOR_RUN_ID;
    else process.env.NODEJS_CONDUCTOR_RUN_ID = oldRunId;
  }
});

test("rejects invalid image evidence and mismatched stable releases", async () => {
  const invalid = await setup();
  await fs.writeFile(invalid.recordPath, JSON.stringify({ validation: "failed", digest: "bad" }));
  await expect(main([invalid.recordPath])).rejects.toThrow(
    "image record must contain a passed validation and registry digest",
  );

  const malformedDigest = await setup();
  const invalidDigest = JSON.parse(await fs.readFile(malformedDigest.recordPath, "utf8"));
  invalidDigest.digest = "";
  await fs.writeFile(malformedDigest.recordPath, JSON.stringify(invalidDigest));
  await expect(main([malformedDigest.recordPath])).rejects.toThrow(
    "image record must contain a passed validation and registry digest",
  );

  const mismatch = await setup();
  const image = JSON.parse(await fs.readFile(mismatch.recordPath, "utf8"));
  image.source_release = "26.13.0";
  image.tag = "26.13.0";
  await fs.writeFile(mismatch.recordPath, JSON.stringify(image));
  await expect(main([mismatch.recordPath])).rejects.toThrow(
    "image release does not match the published stable RPM",
  );
});

test("rejects an existing generation and removes stage data after signing errors", async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-11-19T12:00:00.000Z"));
  const existing = await setup();
  await fs.mkdir(
    path.join(existing.root, ".generations/node-v26.13.1-el10-x86_64-20261119120000000"),
    { recursive: true },
  );
  await expect(main([existing.recordPath])).rejects.toThrow("generation already exists");

  const failed = await setup();
  spawnSync.mockReturnValue({ status: 2, stderr: "bad signing key" });
  await expect(main([failed.recordPath])).rejects.toThrow(
    "gpg exited with status 2: bad signing key",
  );
  const generations = await fs.readdir(path.join(failed.root, ".generations"));
  expect(generations.every((name) => !name.startsWith(".staging-"))).toBe(true);
  delete process.env.NODEJS_REPOSITORY_ROOT;
  delete process.env.NODEJS_SIGNING_KEY;
  jest.useRealTimers();
});

test("keeps an activated generation when writing the command result fails", async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-11-19T12:00:00.000Z"));
  const { root, recordPath } = await setup();
  const output = jest.spyOn(process.stdout, "write").mockImplementation(() => {
    throw new Error("output failed");
  });
  try {
    await expect(main([recordPath])).rejects.toThrow("output failed");
    const active = JSON.parse(
      await fs.readFile(path.join(root, "metadata/active-generation.json"), "utf8"),
    );
    await expect(
      fs.stat(path.join(root, ".generations", active.generation, "metadata/catalog.json")),
    ).resolves.toBeDefined();
  } finally {
    output.mockRestore();
    delete process.env.NODEJS_REPOSITORY_ROOT;
    delete process.env.NODEJS_SIGNING_KEY;
    jest.useRealTimers();
  }
});

test("preserves a complete generation when activation fails after switching a pointer", async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-11-19T12:00:00.000Z"));
  const { root, recordPath } = await setup();
  const output = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const activateWithFailure = async (options) => {
    const replacePointer = options.files.replacePointer;
    let calls = 0;
    options.files.replacePointer = async (...args) => {
      calls += 1;
      if (calls === 2) throw new Error("second pointer failed");
      return replacePointer(...args);
    };
    try {
      await activateGeneration(options);
    } finally {
      options.files.replacePointer = replacePointer;
    }
  };
  try {
    await expect(main([recordPath], { activateGeneration: activateWithFailure })).rejects.toThrow(
      "second pointer failed",
    );
    const stable = path.join(root, "el10/x86_64/stable");
    expect(await fs.readlink(stable)).toContain(".generations/node-v26.13.1-el10-x86_64-");
    const generations = await fs.readdir(path.join(root, ".generations"));
    const generation = generations.find((name) => name.startsWith("node-v26.13.1-el10-x86_64-"));
    expect(generation).toBeDefined();
    await expect(
      fs.readFile(
        path.join(root, ".generations", generation, "el10/x86_64/stable/repodata/repomd.xml"),
        "utf8",
      ),
    ).resolves.toBe("repodata");
  } finally {
    output.mockRestore();
    delete process.env.NODEJS_REPOSITORY_ROOT;
    delete process.env.NODEJS_SIGNING_KEY;
    jest.useRealTimers();
  }
});
