import { expect, jest, test } from "@jest/globals";
const runConductor = jest.fn();
const createConductorConfig = jest.fn(() => ({ dryRun: true }));
jest.unstable_mockModule("../../src/conductor/config.mjs", () => ({
  default: createConductorConfig,
}));
jest.unstable_mockModule("../../src/conductor.mjs", () => ({ default: runConductor }));
const { default: main } = await import("../../src/conductor/entrypoint.mjs");

test("builds a configuration and starts the conductor workflow", async () => {
  const argv = ["--dry-run"];
  const env = { NODEJS_REPOSITORY_URL: "https://repo.example.test" };
  await main(argv, env);
  expect(createConductorConfig).toHaveBeenCalledWith(argv, env);
  expect(runConductor).toHaveBeenCalledWith({ dryRun: true });
});

test("uses process arguments and environment by default", async () => {
  const argv = process.argv;
  process.argv = [process.execPath, "conductor.mjs", "--wet-run"];
  try {
    await main();
    expect(createConductorConfig).toHaveBeenLastCalledWith(process.argv.slice(2), process.env);
  } finally {
    process.argv = argv;
  }
});
