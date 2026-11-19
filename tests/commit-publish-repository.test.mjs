import { expect, jest, test } from "@jest/globals";
import path from "node:path";
import memoryFilesystemFixture from "../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const spawnSync = jest.fn();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:child_process", () => ({ spawnSync }));
const { default: repositoryModule } = await import("../src/commit-publish-repository.mjs");
const { repositoryGitSettings, main } = repositoryModule();

test("uses default and configured Git settings", () => {
  expect(repositoryGitSettings()).toEqual({
    repositoryRoot: path.resolve("/eliware/nodejs-repository"),
    remote: "origin",
    branch: "main",
    userName: "Eliware",
    userEmail: "nodejs-release@eliware.org",
  });
  expect(
    repositoryGitSettings({
      NODEJS_REPOSITORY_ROOT: path.resolve("/tmp/repository"),
      NODEJS_REPOSITORY_GIT_REMOTE: "backup",
      NODEJS_REPOSITORY_GIT_BRANCH: "release",
      NODEJS_REPOSITORY_GIT_USER_NAME: "Build Bot",
      NODEJS_REPOSITORY_GIT_USER_EMAIL: "build@example.test",
    }),
  ).toEqual({
    repositoryRoot: path.resolve("/tmp/repository"),
    remote: "backup",
    branch: "release",
    userName: "Build Bot",
    userEmail: "build@example.test",
  });
});

async function setupRepository() {
  spawnSync.mockClear();
  const root = path.resolve("/virtual/nodejs-repository");
  await fs.mkdir(`${root}/metadata`, { recursive: true });
  await fs.writeFile(
    `${root}/metadata/active-generation.json`,
    JSON.stringify({ generation: "generation-1" }),
  );
  process.env.NODEJS_REPOSITORY_ROOT = root;
  return root;
}

test("skips a commit when the repository has no changes", async () => {
  await setupRepository();
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  spawnSync.mockReturnValueOnce({ status: 0, stdout: "", stderr: "" });
  try {
    await expect(main()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("[repo-git] repository is clean. Nothing to commit.");
  } finally {
    log.mockRestore();
    delete process.env.NODEJS_REPOSITORY_ROOT;
  }
});

test("commits repository changes and pushes the configured branch", async () => {
  const root = await setupRepository();
  process.env.NODEJS_REPOSITORY_GIT_REMOTE = "backup";
  process.env.NODEJS_REPOSITORY_GIT_BRANCH = "stable";
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  spawnSync
    .mockReturnValueOnce({ status: 0, stdout: " M metadata/catalog.json\n", stderr: "" })
    .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
    .mockReturnValueOnce({ status: 0, stdout: "commit output", stderr: "" })
    .mockReturnValueOnce({ status: 0, stdout: "push output", stderr: "" });
  try {
    await main();
    expect(spawnSync).toHaveBeenNthCalledWith(
      4,
      "git",
      ["push", "backup", "stable:stable"],
      expect.objectContaining({ cwd: root }),
    );
    expect(stdout).toHaveBeenCalledWith("commit output");
    expect(stdout).toHaveBeenCalledWith("push output");
    expect(log).toHaveBeenCalledWith("[repo-git] committed and pushed generation generation-1");
  } finally {
    stdout.mockRestore();
    log.mockRestore();
    delete process.env.NODEJS_REPOSITORY_ROOT;
    delete process.env.NODEJS_REPOSITORY_GIT_REMOTE;
    delete process.env.NODEJS_REPOSITORY_GIT_BRANCH;
  }
});

test("reports Git status, commit, and push failures", async () => {
  await setupRepository();
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  spawnSync.mockReturnValueOnce({ status: 2, stdout: "", stderr: "status failed" });
  await expect(main()).rejects.toThrow("git status failed: status failed");
  spawnSync
    .mockReturnValueOnce({ status: 0, stdout: "changed", stderr: "" })
    .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
    .mockReturnValueOnce({ status: 1, stdout: "", stderr: "commit failed" });
  await expect(main()).rejects.toThrow("git commit failed: commit failed");
  spawnSync
    .mockReturnValueOnce({ status: 0, stdout: "changed", stderr: "" })
    .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
    .mockReturnValueOnce({ status: 0, stdout: "commit", stderr: "" })
    .mockReturnValueOnce({ status: 1, stdout: "", stderr: "push failed" });
  await expect(main()).rejects.toThrow("git push failed: push failed");

  spawnSync.mockReturnValueOnce({ error: new Error("git unavailable") });
  await expect(main()).rejects.toThrow("git unavailable");
  spawnSync.mockReturnValueOnce({ status: 1, stdout: "status output", stderr: "" });
  await expect(main()).rejects.toThrow("git status failed: status output");
  spawnSync
    .mockReturnValueOnce({ status: 0, stdout: "changed", stderr: "" })
    .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
    .mockReturnValueOnce({ error: new Error("commit unavailable") });
  await expect(main()).rejects.toThrow("commit unavailable");
  spawnSync
    .mockReturnValueOnce({ status: 0, stdout: "changed", stderr: "" })
    .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
    .mockReturnValueOnce({ status: 1, stdout: "commit output", stderr: "" });
  await expect(main()).rejects.toThrow("git commit failed: commit output");
  spawnSync
    .mockReturnValueOnce({ status: 0, stdout: "changed", stderr: "" })
    .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
    .mockReturnValueOnce({ status: 0, stdout: "commit", stderr: "" })
    .mockReturnValueOnce({ error: new Error("push unavailable") });
  await expect(main()).rejects.toThrow("push unavailable");
  spawnSync
    .mockReturnValueOnce({ status: 0, stdout: "changed", stderr: "" })
    .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
    .mockReturnValueOnce({ status: 0, stdout: "commit", stderr: "" })
    .mockReturnValueOnce({ status: 1, stdout: "push output", stderr: "" });
  await expect(main()).rejects.toThrow("git push failed: push output");
  delete process.env.NODEJS_REPOSITORY_ROOT;
  stdout.mockRestore();
});
