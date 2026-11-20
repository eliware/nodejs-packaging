import path from "node:path";
import writeImageCatalog from "./catalog.mjs";
import writeImageEvidence from "./evidence.mjs";
import createImageRecord from "./record-data.mjs";

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
  const active = { metadata_version: "0.1.0", schema: 1, generation: generationId, generated };
  await files.writeJson(path.join(stage, "metadata/active-generation.json"), active);
  await files.writeJson(path.join(stage, "generation.json"), active);
  return { imageRecord, catalogPath };
}
