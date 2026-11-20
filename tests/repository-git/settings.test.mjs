import path from "node:path";
import { expect, test } from "@jest/globals";
import repositoryGitSettings from "../../src/repository-git/settings.mjs";

test("resolves default and configured Git settings", () => {
  expect(repositoryGitSettings()).toMatchObject({
    remote: expect.any(String),
    branch: expect.any(String),
  });
  expect(repositoryGitSettings({})).toEqual({
    repositoryRoot: path.resolve("/eliware/nodejs-repository"),
    remote: "origin",
    branch: "main",
    userName: "Eliware",
    userEmail: "nodejs-release@eliware.org",
  });
  expect(
    repositoryGitSettings({
      NODEJS_REPOSITORY_ROOT: "/repo",
      NODEJS_REPOSITORY_GIT_REMOTE: "backup",
      NODEJS_REPOSITORY_GIT_BRANCH: "stable",
      NODEJS_REPOSITORY_GIT_USER_NAME: "Build Bot",
      NODEJS_REPOSITORY_GIT_USER_EMAIL: "build@example.test",
    }),
  ).toMatchObject({ remote: "backup", branch: "stable", userName: "Build Bot" });
});
