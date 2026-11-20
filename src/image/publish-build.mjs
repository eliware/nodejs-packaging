import runDocker from "./docker.mjs";
import publishImage from "./publish.mjs";

export default async function publishBuiltImage(image, repository) {
  const versionDigest = await publishImage(image);
  const latestImage = `${repository}:latest`;
  runDocker(["tag", image, latestImage], { stdio: "inherit" });
  const latestDigest = await publishImage(latestImage);
  if (latestDigest !== versionDigest)
    throw new Error(`latest image digest ${latestDigest} does not match ${versionDigest}`);
  return versionDigest;
}
