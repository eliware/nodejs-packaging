import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

function repositoryGitSettings(env = process.env) {
  return {
    repositoryRoot: path.resolve(env.NODEJS_REPOSITORY_ROOT || "/eliware/nodejs-repository"),
    remote: env.NODEJS_REPOSITORY_GIT_REMOTE || "origin",
    branch: env.NODEJS_REPOSITORY_GIT_BRANCH || "main",
    userName: env.NODEJS_REPOSITORY_GIT_USER_NAME || "Eliware",
    userEmail: env.NODEJS_REPOSITORY_GIT_USER_EMAIL || "nodejs-release@eliware.org",
  };
}

async function main() {
  const { repositoryRoot, remote, branch, userName, userEmail } = repositoryGitSettings();
  const active = JSON.parse(
    await readFile(path.join(repositoryRoot, "metadata/active-generation.json"), "utf8"),
  );
  const runGit = (args) => {
    const result = spawnSync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`git ${args[0]} failed: ${result.stderr || result.stdout}`);
    return result;
  };
  const status = runGit(["status", "--porcelain=v1"]);
  if (!status.stdout.trim()) {
    console.log("[repo-git] repository is clean. Nothing to commit.");
  } else {
    runGit(["add", "--all"]);
    const commit = spawnSync(
      "git",
      [
        "-c",
        `user.name=${userName}`,
        "-c",
        `user.email=${userEmail}`,
        "commit",
        "-m",
        `Publish Node.js repository generation ${active.generation}`,
      ],
      { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    if (commit.error) throw commit.error;
    if (commit.status !== 0)
      throw new Error(`git commit failed: ${commit.stderr || commit.stdout}`);
    process.stdout.write(commit.stdout);
  }
  const push = spawnSync("git", ["push", remote, `${branch}:${branch}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (push.error) throw push.error;
  if (push.status !== 0) throw new Error(`git push failed: ${push.stderr || push.stdout}`);
  process.stdout.write(push.stdout);
  console.log(`[repo-git] pushed generation ${active.generation}`);
}

export default function moduleApi() {
  return { repositoryGitSettings, main };
}
