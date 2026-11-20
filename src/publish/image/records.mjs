import writeImageCatalog from "./catalog.mjs";
import writeImageEvidence from "./evidence.mjs";
import createImageRecord from "./record-data.mjs";
import writeImageGenerationMetadata from "./generation-metadata.mjs";

export default async function writeImageRecords({
  stage,
  image,
  generationId,
  generated,
  keyFingerprint,
  gpgHome,
  files,
}) {
  const imageRecord = createImageRecord(image);
  const catalogPath = await writeImageCatalog({
    stage,
    image,
    imageRecord,
    generationId,
    generated,
    files,
  });
  await writeImageEvidence({
    stage,
    image,
    imageRecord,
    generationId,
    generated,
    keyFingerprint,
    gpgHome,
    files,
  });
  await writeImageGenerationMetadata({ stage, generationId, generated, files });
  return { imageRecord, catalogPath };
}
