import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const spawnSync = jest.fn();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:child_process", () => ({ spawnSync }));
const { default: runRepositoryTool } = await import("../../src/publish/repository-tools.mjs");

test("runs repository tools and writes accumulated redacted logs", async () => {
  const output = [];
  const root = "/virtual/tool-generation";
  const env = {
    API_TOKEN: "private-token-value",
    NODEJS_CONDUCTOR_LOG_DIR: "/virtual/logs",
    NODEJS_CONDUCTOR_RUN_ID: "run-1",
  };
  spawnSync.mockReturnValueOnce({ status: 0, stdout: "done", stderr: "" });
  await expect(
    runRepositoryTool({
      command: "createrepo_c",
      args: ["stable"],
      extraEnv: { GNUPGHOME: "/keys" },
      stagingRoot: root,
      output,
      env,
    }),
  ).resolves.toEqual({ status: 0, stdout: "done", stderr: "" });
  expect(spawnSync).toHaveBeenCalledWith("createrepo_c", ["stable"], {
    encoding: "utf8",
    env: { ...env, GNUPGHOME: "/keys" },
  });
  const logPath = path.join(root, "metadata/logs/run-1/repository-tools.log");
  await expect(fs.readFile(logPath, "utf8")).resolves.toContain("done");

  spawnSync.mockReturnValueOnce({ status: 4, stdout: "", stderr: "failed private-token-value" });
  await expect(
    runRepositoryTool({ command: "gpg", args: [], stagingRoot: root, output, env }),
  ).rejects.toThrow("gpg exited with status 4: failed [REDACTED]");
  await expect(fs.readFile(logPath, "utf8")).resolves.not.toContain("private-token-value");
});

test("rethrows launch errors and skips logs when log context is missing", async () => {
  const output = [];
  const error = new Error("tool unavailable");
  spawnSync.mockReturnValueOnce({ error });
  await expect(
    runRepositoryTool({
      command: "gpg",
      args: [],
      stagingRoot: "/virtual/tools",
      output,
      env: {},
    }),
  ).rejects.toBe(error);
  expect(output).toEqual(["gpg: tool unavailable"]);

  spawnSync.mockReturnValueOnce({ status: 0, stdout: "ok" });
  await expect(
    runRepositoryTool({
      command: "gpg",
      args: [],
      stagingRoot: "/virtual/tools",
      output,
      env: { NODEJS_CONDUCTOR_LOG_DIR: "/virtual/logs" },
    }),
  ).resolves.toEqual({ status: 0, stdout: "ok" });
});
