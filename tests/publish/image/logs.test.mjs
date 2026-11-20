import path from "node:path";
import { expect, jest, test } from "@jest/globals";

const cp = jest.fn(async () => {});
jest.unstable_mockModule("node:fs/promises", () => ({ cp }));
const { default: copyConductorLogs } = await import("../../../src/publish/image/logs.mjs");

test("copies conductor logs into the generation log directory", async () => {
  const previousDirectory = process.env.NODEJS_CONDUCTOR_LOG_DIR;
  const previousRunId = process.env.NODEJS_CONDUCTOR_RUN_ID;
  process.env.NODEJS_CONDUCTOR_LOG_DIR = "/var/log/nodejs/run-7";
  process.env.NODEJS_CONDUCTOR_RUN_ID = "run-7";
  try {
    await copyConductorLogs("/repository/.generations/stage");
    expect(cp).toHaveBeenCalledWith(
      "/var/log/nodejs/run-7",
      path.join("/repository/.generations/stage", "metadata/logs/run-7"),
      { recursive: true, force: true },
    );
  } finally {
    if (previousDirectory === undefined) delete process.env.NODEJS_CONDUCTOR_LOG_DIR;
    else process.env.NODEJS_CONDUCTOR_LOG_DIR = previousDirectory;
    if (previousRunId === undefined) delete process.env.NODEJS_CONDUCTOR_RUN_ID;
    else process.env.NODEJS_CONDUCTOR_RUN_ID = previousRunId;
  }
});

test("skips copying when log configuration is incomplete", async () => {
  cp.mockClear();
  await copyConductorLogs("/repository/.generations/stage", "", "run-7");
  await copyConductorLogs("/repository/.generations/stage", "/var/log/nodejs", "");
  expect(cp).not.toHaveBeenCalled();
});
