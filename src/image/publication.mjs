import publishBuiltImage from "./publish-build.mjs";
import writeImageRecord from "./record.mjs";
import inspectPublishedImage from "./inspection.mjs";

export default async function publishImage({
  image,
  target,
  pushImage,
  version,
  root,
  args,
  sourceInput,
  publishedRelease,
  baseImage,
  baseDigest,
  runDocker,
}) {
  const registryDigest = pushImage ? await publishBuiltImage(image, target.image) : null;
  const { record, resultDir } = inspectPublishedImage({
    target,
    pushImage,
    version,
    root,
    args,
    sourceInput,
    publishedRelease,
    baseImage,
    baseDigest,
    runDocker,
    image,
    registryDigest,
  });
  await writeImageRecord(resultDir, record);
}
