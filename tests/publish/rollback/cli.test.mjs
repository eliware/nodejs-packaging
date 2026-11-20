import { expect, jest, test } from "@jest/globals";
import path from "node:path";

const rollbackGeneration = jest.fn(async (root, generation) => generation);
jest.unstable_mockModule("../../../src/publish/rollback/run.mjs", () => ({
  default: rollbackGeneration,
}));
const { default: rollbackRepository } = await import("../../../src/publish/rollback/cli.mjs");

test("reports successful restores for configured and default inputs", async () => {
  const output = { log: jest.fn(), error: jest.fn() };
  const keyFingerprint = "A".repeat(40);
  const generation = "node-v26.13.1-el10-x86_64-20261119161944";
  const gpgHome = path.resolve("/var/lib/eliware/nodejs-signing/gnupg");
  const repositoryRoot = path.resolve("/repo");
  await rollbackRepository(
    ["--generation", generation],
    { NODEJS_REPOSITORY_ROOT: repositoryRoot, NODEJS_SIGNING_KEY: keyFingerprint },
    output,
  );
  expect(rollbackGeneration).toHaveBeenCalledWith(repositoryRoot, generation, {
    keyFingerprint,
    gpgHome,
  });
  expect(output.log).toHaveBeenCalledWith(`Restored ${generation}`);

  const argv = process.argv;
  const previousRoot = process.env.NODEJS_REPOSITORY_ROOT;
  const previousKey = process.env.NODEJS_SIGNING_KEY;
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  process.argv = [process.execPath, "rollback-repository.mjs", "--generation", generation];
  const defaultRoot = path.resolve("/default-repo");
  process.env.NODEJS_REPOSITORY_ROOT = defaultRoot;
  process.env.NODEJS_SIGNING_KEY = keyFingerprint;
  try {
    await rollbackRepository();
    expect(rollbackGeneration).toHaveBeenLastCalledWith(defaultRoot, generation, {
      keyFingerprint,
      gpgHome,
    });
    expect(log).toHaveBeenCalledWith(`Restored ${generation}`);
  } finally {
    process.argv = argv;
    if (previousRoot === undefined) delete process.env.NODEJS_REPOSITORY_ROOT;
    else process.env.NODEJS_REPOSITORY_ROOT = previousRoot;
    if (previousKey === undefined) delete process.env.NODEJS_SIGNING_KEY;
    else process.env.NODEJS_SIGNING_KEY = previousKey;
    log.mockRestore();
  }
});

test("reports rollback failures through the CLI output", async () => {
  const oldStatus = process.exitCode;
  const output = { log: jest.fn(), error: jest.fn() };
  rollbackGeneration.mockRejectedValueOnce(new Error("rollback failed"));
  const keyFingerprint = "A".repeat(40);
  try {
    process.exitCode = 0;
    await rollbackRepository(
      ["--generation", "node-v26.13.1-el10-x86_64-20261119161944"],
      { NODEJS_SIGNING_KEY: keyFingerprint },
      output,
    );
    expect(output.error).toHaveBeenCalledWith("rollback failed");
    expect(process.exitCode).toBe(1);
  } finally {
    process.exitCode = oldStatus;
  }
});

test.each([
  { argv: ["--generation", "bad"], env: { NODEJS_SIGNING_KEY: "A".repeat(40) } },
  { argv: ["--generation", "node-v26.13.1-el10-x86_64-20261119161944"], env: {} },
])("reports invalid rollback input through the CLI", async ({ argv, env }) => {
  const oldStatus = process.exitCode;
  const output = { log: jest.fn(), error: jest.fn() };
  rollbackGeneration.mockClear();
  try {
    process.exitCode = 0;
    await rollbackRepository(argv, env, output);
    expect(output.error).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(rollbackGeneration).not.toHaveBeenCalled();
  } finally {
    process.exitCode = oldStatus;
  }
});
