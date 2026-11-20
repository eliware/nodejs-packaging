import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const commitAndPushRepository = jest.fn();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("../src/repository-git/commit-push.mjs", () => ({
  default: commitAndPushRepository,
}));
const { default: main } = await import("../src/commit-publish-repository.mjs");

test("loads the active generation and delegates Git publication with defaults", async () => {
  const repositoryRoot = "/virtual/repository-main";
  await fs.mkdir(path.join(repositoryRoot, "metadata"), { recursive: true });
  await fs.writeFile(
    path.join(repositoryRoot, "metadata/active-generation.json"),
    JSON.stringify({ generation: "generation-1" }),
  );
  const previousRoot = process.env.NODEJS_REPOSITORY_ROOT;
  process.env.NODEJS_REPOSITORY_ROOT = repositoryRoot;
  try {
    await main();
    expect(commitAndPushRepository).toHaveBeenCalledWith({
      repositoryRoot: path.resolve(repositoryRoot),
      remote: "origin",
      branch: "main",
      userName: "Eliware",
      userEmail: "nodejs-release@eliware.org",
      generation: "generation-1",
    });
  } finally {
    if (previousRoot === undefined) delete process.env.NODEJS_REPOSITORY_ROOT;
    else process.env.NODEJS_REPOSITORY_ROOT = previousRoot;
  }
});

test("uses the default repository path when no root is configured", async () => {
  const repositoryRoot = "/eliware/nodejs-repository";
  await fs.mkdir(path.join(repositoryRoot, "metadata"), { recursive: true });
  await fs.writeFile(
    path.join(repositoryRoot, "metadata/active-generation.json"),
    JSON.stringify({ generation: "generation-default" }),
  );
  await main({});
  expect(commitAndPushRepository).toHaveBeenLastCalledWith(
    expect.objectContaining({
      repositoryRoot: path.resolve(repositoryRoot),
      generation: "generation-default",
    }),
  );
});

test("passes configured Git settings to the publication operation", async () => {
  const repositoryRoot = "/virtual/repository-configured";
  await fs.mkdir(path.join(repositoryRoot, "metadata"), { recursive: true });
  await fs.writeFile(
    path.join(repositoryRoot, "metadata/active-generation.json"),
    JSON.stringify({ generation: "generation-2" }),
  );
  await main({
    NODEJS_REPOSITORY_ROOT: repositoryRoot,
    NODEJS_REPOSITORY_GIT_REMOTE: "backup",
    NODEJS_REPOSITORY_GIT_BRANCH: "stable",
    NODEJS_REPOSITORY_GIT_USER_NAME: "Build Bot",
    NODEJS_REPOSITORY_GIT_USER_EMAIL: "build@example.test",
  });
  expect(commitAndPushRepository).toHaveBeenLastCalledWith({
    repositoryRoot: path.resolve(repositoryRoot),
    remote: "backup",
    branch: "stable",
    userName: "Build Bot",
    userEmail: "build@example.test",
    generation: "generation-2",
  });
});
