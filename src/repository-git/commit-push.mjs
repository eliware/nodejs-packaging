import { spawnSync } from "node:child_process";

export default function commitAndPushRepository({
  repositoryRoot,
  remote,
  branch,
  userName,
  userEmail,
  generation,
  run = spawnSync,
}) {
  const runGit = (args) => {
    const result = run("git", args, {
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
    runGit(["add", "--all", "--", ".generations", "el10", "keys", "metadata", "nodejs26.repo"]);
    const commit = runGit([
      "-c",
      `user.name=${userName}`,
      "-c",
      `user.email=${userEmail}`,
      "commit",
      "-m",
      `Publish Node.js repository generation ${generation}`,
    ]);
    process.stdout.write(commit.stdout);
  }
  const push = runGit(["push", remote, `${branch}:${branch}`]);
  process.stdout.write(push.stdout);
  console.log(`[repo-git] pushed generation ${generation}`);
}
