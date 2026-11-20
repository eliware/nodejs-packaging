import path from "node:path";

export default function buildImage({
  runDocker,
  root,
  version,
  sourceInput,
  repositoryBase,
  generationId,
  image,
  baseDigest,
  context,
}) {
  return runDocker(
    [
      "build",
      "--file",
      path.join(root, "containers/centos10-node26.Dockerfile"),
      "--build-arg",
      `NODE_VERSION=${version}`,
      "--build-arg",
      `SOURCE_SHA256=${sourceInput.source.sha256}`,
      "--build-arg",
      `BASE_IMAGE_DIGEST=${baseDigest.slice(baseDigest.lastIndexOf("@") + 1)}`,
      "--build-arg",
      `NODEJS_REPOSITORY_URL=${repositoryBase}`,
      "--build-arg",
      `REPOSITORY_GENERATION=${generationId}`,
      "--tag",
      image,
      context,
    ],
    { stdio: "inherit" },
  );
}
