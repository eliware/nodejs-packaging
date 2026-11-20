import publishBuiltImage from "./publish-build.mjs";
import writeImageRecord from "./record.mjs";
import createImageRecordData from "./record-data.mjs";

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
  const inspect = JSON.parse(
    runDocker(["image", "inspect", image], { encoding: "utf8" }).stdout,
  )[0];
  const { record, resultDir } = createImageRecordData({
    target,
    pushImage,
    version,
    root,
    args,
    sourceInput,
    publishedRelease,
    baseImage,
    baseDigest,
    inspect,
    registryDigest,
  });
  await writeImageRecord(resultDir, record);
}
