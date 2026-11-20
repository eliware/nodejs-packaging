import { expect, jest, test } from "@jest/globals";

const rollbackGeneration = jest.fn(async (root, generation) => generation);
jest.unstable_mockModule("../../../src/publish/rollback/run.mjs", () => ({
  default: rollbackGeneration,
}));
const { default: rollbackRepository } = await import("../../../src/publish/rollback/cli.mjs");

test("reports successful restores for configured and default inputs", async () => {
  const output = { log: jest.fn(), error: jest.fn() };
  const generation = "node-v26.13.1-el10-x86_64-20261119161944";
  await rollbackRepository(
    ["--generation", generation],
    { NODEJS_REPOSITORY_ROOT: "/repo" },
    output,
  );
  expect(rollbackGeneration).toHaveBeenCalledWith("/repo", generation);
  expect(output.log).toHaveBeenCalledWith(`Restored ${generation}`);

  const argv = process.argv;
  const previousRoot = process.env.NODEJS_REPOSITORY_ROOT;
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  process.argv = [process.execPath, "rollback-repository.mjs", "--generation", generation];
  process.env.NODEJS_REPOSITORY_ROOT = "/default-repo";
  try {
    await rollbackRepository();
    expect(rollbackGeneration).toHaveBeenLastCalledWith("/default-repo", generation);
    expect(log).toHaveBeenCalledWith(`Restored ${generation}`);
  } finally {
    process.argv = argv;
    if (previousRoot === undefined) delete process.env.NODEJS_REPOSITORY_ROOT;
    else process.env.NODEJS_REPOSITORY_ROOT = previousRoot;
    log.mockRestore();
  }
});

test("reports rollback failures through the CLI output", async () => {
  const oldStatus = process.exitCode;
  const output = { log: jest.fn(), error: jest.fn() };
  rollbackGeneration.mockRejectedValueOnce(new Error("rollback failed"));
  try {
    process.exitCode = 0;
    await rollbackRepository(["--generation", "bad"], {}, output);
    expect(output.error).toHaveBeenCalledWith("rollback failed");
    expect(process.exitCode).toBe(1);
  } finally {
    process.exitCode = oldStatus;
  }
});
