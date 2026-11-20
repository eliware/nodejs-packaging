import { spawnSync } from "node:child_process";

export default function runDocker(args, options = {}, checkStatus = true) {
  const result = spawnSync("docker", args, options);
  if (result.error) throw result.error;
  if (checkStatus && result.status !== 0)
    throw new Error(`docker ${args[0]} exited with status ${result.status}`);
  return result;
}
