import { expect, jest, test } from "@jest/globals";

const spawnSync = jest.fn();
jest.unstable_mockModule("node:child_process", () => ({ spawnSync }));
const { default: commitAndPushRepository } =
  await import("../../src/repository-git/commit-push.mjs");

function input(overrides = {}) {
  return {
    repositoryRoot: "/virtual/repository",
    remote: "origin",
    branch: "main",
    userName: "Eliware",
    userEmail: "nodejs-release@eliware.org",
    generation: "generation-1",
    ...overrides,
  };
}

test("pushes a clean repository without creating a commit", () => {
  const run = jest.fn(() => ({ status: 0, stdout: "", stderr: "" }));
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  try {
    commitAndPushRepository(input({ run }));
    expect(run).toHaveBeenNthCalledWith(
      1,
      "git",
      ["status", "--porcelain=v1"],
      expect.objectContaining({ cwd: "/virtual/repository" }),
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      "git",
      ["push", "origin", "main:main"],
      expect.any(Object),
    );
    expect(log).toHaveBeenCalledWith("[repo-git] repository is clean. Nothing to commit.");
  } finally {
    log.mockRestore();
  }
});

test("commits allowed repository paths and pushes the configured branch", () => {
  const run = jest
    .fn()
    .mockReturnValueOnce({ status: 0, stdout: " M metadata/catalog.json", stderr: "" })
    .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
    .mockReturnValueOnce({ status: 0, stdout: "commit output", stderr: "" })
    .mockReturnValueOnce({ status: 0, stdout: "push output", stderr: "" });
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  try {
    commitAndPushRepository(input({ remote: "backup", branch: "stable", run }));
    expect(run).toHaveBeenNthCalledWith(
      2,
      "git",
      ["add", "--all", "--", ".generations", "el10", "keys", "metadata", "nodejs26.repo"],
      expect.any(Object),
    );
    expect(run).toHaveBeenNthCalledWith(
      3,
      "git",
      [
        "-c",
        "user.name=Eliware",
        "-c",
        "user.email=nodejs-release@eliware.org",
        "commit",
        "-m",
        "Publish Node.js repository generation generation-1",
      ],
      expect.any(Object),
    );
    expect(run).toHaveBeenNthCalledWith(
      4,
      "git",
      ["push", "backup", "stable:stable"],
      expect.any(Object),
    );
    expect(stdout).toHaveBeenCalledWith("commit output");
    expect(stdout).toHaveBeenCalledWith("push output");
  } finally {
    stdout.mockRestore();
    log.mockRestore();
  }
});

test("uses the Git process runner by default", () => {
  spawnSync.mockReturnValue({ status: 0, stdout: "", stderr: "" });
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  try {
    commitAndPushRepository(input());
    expect(spawnSync).toHaveBeenNthCalledWith(
      1,
      "git",
      ["status", "--porcelain=v1"],
      expect.objectContaining({ cwd: "/virtual/repository" }),
    );
    expect(spawnSync).toHaveBeenNthCalledWith(
      2,
      "git",
      ["push", "origin", "main:main"],
      expect.any(Object),
    );
  } finally {
    log.mockRestore();
  }
});

test("reports Git command errors and nonzero exits", () => {
  expect(() =>
    commitAndPushRepository(input({ run: () => ({ error: new Error("git missing") }) })),
  ).toThrow("git missing");
  expect(() =>
    commitAndPushRepository(
      input({ run: () => ({ status: 1, stdout: "status output", stderr: "" }) }),
    ),
  ).toThrow("git status failed: status output");
});
