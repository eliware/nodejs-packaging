import path from "node:path";
import { Readable } from "node:stream";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";
import imagePublicationFixture from "../../../test-fixtures/image-publication.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const setupImagePublication = imagePublicationFixture(fs);
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
const digest = `sha256:${"a".repeat(64)}`;

async function setup() {
  const result = await setupImagePublication();
  spawnSync.mockReset().mockImplementation((command, args) => {
    if (args.includes("--detach-sign")) fs.writeFileSync(`${args.at(-1)}.asc`, "signed");
    return { status: 0, stdout: "", stderr: "" };
  });
  return result;
}

test("reads the record path from process arguments by default", async () => {
  await setup();
  const argv = process.argv;
  process.argv = [process.execPath, "image-record.mjs"];
  try {
    await expect(main()).rejects.toThrow("pass the published image record path");
  } finally {
    process.argv = argv;
    delete process.env.NODEJS_REPOSITORY_ROOT;
    delete process.env.NODEJS_SIGNING_KEY;
  }
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
    const active = JSON.parse(
      await fs.readFile(path.join(root, "metadata/active-generation.json"), "utf8"),
    );
    expect(catalog.images[0]).toEqual(expect.objectContaining({ node_version: "26.13.1", digest }));
    expect(active.generation).toMatch(/^node-v26\.13\.1-el10-x86_64-\d+$/);
    const generationRoot = path.join(root, ".generations", active.generation);
    expect(catalog.stable.latest.image).toEqual(
      expect.objectContaining({ digest, validation: "passed", logs_path: "metadata/logs/run-7/" }),
    );
    expect(
      JSON.parse(
        await fs.readFile(path.join(generationRoot, "metadata/validation/image.json"), "utf8"),
      ),
    ).toEqual(
      expect.objectContaining({ smoke_test: "passed", registry_push: "passed", status: "passed" }),
    );
    expect(
      JSON.parse(
        await fs.readFile(
          path.join(generationRoot, "metadata/provenance/images/nodejs26-26.13.1.json"),
          "utf8",
        ),
      ),
    ).toEqual(
      expect.objectContaining({
        image: expect.objectContaining({ digest, validation: "passed" }),
        source_sha256: "d".repeat(64),
      }),
    );
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

test("removes an inactive generation after activation fails and allows a retry", async () => {
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
    await expect(fs.readlink(stable)).rejects.toMatchObject({ code: "EINVAL" });
    let generations = await fs.readdir(path.join(root, ".generations"));
    expect(generations.some((name) => name.startsWith("node-v26.13.1-el10-x86_64-"))).toBe(false);
    await main([recordPath]);
    generations = await fs.readdir(path.join(root, ".generations"));
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

test("keeps a generation when activation rollback also fails", async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-11-19T12:00:00.000Z"));
  const { root, recordPath } = await setup();
  const output = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    await expect(
      main([recordPath], {
        activateGeneration: async () => {
          throw new AggregateError([new Error("restore failed")], "activation rollback failed");
        },
      }),
    ).rejects.toThrow("activation rollback failed");
    const generations = await fs.readdir(path.join(root, ".generations"));
    expect(generations).toContain("node-v26.13.1-el10-x86_64-20261119120000000");
  } finally {
    output.mockRestore();
    delete process.env.NODEJS_REPOSITORY_ROOT;
    delete process.env.NODEJS_SIGNING_KEY;
    jest.useRealTimers();
  }
});
