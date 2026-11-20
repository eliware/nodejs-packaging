import { spawnSync as spawnProcessSync } from "node:child_process";

export default async function publishImage(
  image,
  run = spawnProcessSync,
  stdout = process.stdout,
  stderr = process.stderr,
) {
  const result = run("docker", ["push", image], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.stdout) stdout.write(result.stdout);
  if (result.stderr) stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`docker push exited with status ${result.status}`);
  const digest =
    `${result.stdout}\n${result.stderr}`.match(/digest:\s*(sha256:[a-f0-9]{64})/i)?.[1] || null;
  if (!digest) throw new Error("docker push completed without reporting an image digest");
  return digest;
}
