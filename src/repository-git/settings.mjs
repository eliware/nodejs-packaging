import path from "node:path";

export default function repositoryGitSettings(env = process.env) {
  return {
    repositoryRoot: path.resolve(env.NODEJS_REPOSITORY_ROOT || "/eliware/nodejs-repository"),
    remote: env.NODEJS_REPOSITORY_GIT_REMOTE || "origin",
    branch: env.NODEJS_REPOSITORY_GIT_BRANCH || "main",
    userName: env.NODEJS_REPOSITORY_GIT_USER_NAME || "Eliware",
    userEmail: env.NODEJS_REPOSITORY_GIT_USER_EMAIL || "nodejs-release@eliware.org",
  };
}
