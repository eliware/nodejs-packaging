import { readFile } from "node:fs/promises";
import path from "node:path";
import commitAndPushRepository from "./repository-git/commit-push.mjs";

function repositoryGitSettings(env = process.env) {
  return {
    repositoryRoot: path.resolve(env.NODEJS_REPOSITORY_ROOT || "/eliware/nodejs-repository"),
    remote: env.NODEJS_REPOSITORY_GIT_REMOTE || "origin",
    branch: env.NODEJS_REPOSITORY_GIT_BRANCH || "main",
    userName: env.NODEJS_REPOSITORY_GIT_USER_NAME || "Eliware",
    userEmail: env.NODEJS_REPOSITORY_GIT_USER_EMAIL || "nodejs-release@eliware.org",
  };
}

export default async function main(env) {
  const settings = repositoryGitSettings(env);
  const active = JSON.parse(
    await readFile(path.join(settings.repositoryRoot, "metadata/active-generation.json"), "utf8"),
  );
  commitAndPushRepository({ ...settings, generation: active.generation });
}
