export default async function getBaseImageDigest({ baseImage, runCommand, runCommandCapture }) {
  await runCommand("docker", ["pull", baseImage]);
  const result = await runCommandCapture("docker", ["image", "inspect", baseImage], {
    quiet: true,
  });
  const inspect = JSON.parse(result.stdout)[0];
  const digest = inspect.RepoDigests?.find((item) =>
    item.startsWith("quay.io/centos/centos@sha256:"),
  );
  if (!digest) throw new Error(`Docker did not report an immutable digest for ${baseImage}`);
  return digest;
}
