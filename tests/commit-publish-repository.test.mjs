import { expect, jest, test } from "@jest/globals";

const commitAndPushRepository = jest.fn();
const repositoryGitSettings = jest.fn(() => ({ repositoryRoot: "/repo", branch: "main" }));
const loadActiveGeneration = jest.fn(async () => "generation-1");
jest.unstable_mockModule("../src/repository-git/commit-push.mjs", () => ({
  default: commitAndPushRepository,
}));
jest.unstable_mockModule("../src/repository-git/settings.mjs", () => ({
  default: repositoryGitSettings,
}));
jest.unstable_mockModule("../src/repository-git/active-generation.mjs", () => ({
  default: loadActiveGeneration,
}));
const { default: main } = await import("../src/commit-publish-repository.mjs");

test("loads settings and the active generation before delegating publication", async () => {
  const env = { NODEJS_REPOSITORY_ROOT: "/repo" };
  await main(env);
  expect(repositoryGitSettings).toHaveBeenCalledWith(env);
  expect(loadActiveGeneration).toHaveBeenCalledWith("/repo");
  expect(commitAndPushRepository).toHaveBeenCalledWith({
    repositoryRoot: "/repo",
    branch: "main",
    generation: "generation-1",
  });
});
