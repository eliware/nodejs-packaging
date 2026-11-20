import createImageRecordData from "./record-data.mjs";

export default function inspectPublishedImage(input) {
  const inspect = JSON.parse(
    input.runDocker(["image", "inspect", input.image], { encoding: "utf8" }).stdout,
  )[0];
  const { runDocker: _runDocker, image: _image, ...recordInput } = input;
  return createImageRecordData({ ...recordInput, inspect });
}
