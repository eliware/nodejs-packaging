import path from "node:path";
import imageCatalogModule from "./catalog.mjs";
import imageEvidenceModule from "./evidence.mjs";

const { writeImageCatalog } = imageCatalogModule();
const { writeImageEvidence } = imageEvidenceModule();

async function writeImageRecords({
  stage,
  image,
  generationId,
  generated,
  keyFingerprint,
  gpgHome,
  files,
}) {
  const provenancePath = `metadata/provenance/images/nodejs26-${image.source_release}.json`;
  const imageRecord = {
    repository: image.repository,
    tag: image.tag,
    digest: image.digest,
    base_image: image.base_image,
    base_image_digest: image.base_image_digest,
    rpm_sha256: image.rpm_sha256,
    validation: "passed",
    provenance_path: provenancePath,
  };
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

export default function imageRecordsModule() {
  return { writeImageRecords };
}
