import { spawnSync } from "node:child_process";

export default function createRepositoryMetadata(directory, run = spawnSync) {
  const result = run("createrepo_c", ["--checksum", "sha256", directory], {
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`createrepo_c exited with status ${result.status}: ${result.stderr}`);
  return result;
}
