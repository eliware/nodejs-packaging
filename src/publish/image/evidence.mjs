import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import signModule from "../sign.mjs";

const { sign } = signModule();

async function writeImageEvidence({
  stage,
  image,
  imageRecord,
  generationId,
  generated,
  keyFingerprint,
  gpgHome,
  files,
}) {
  const packageProvenancePath = path.join(stage, "metadata/provenance/package.json");
  const packageProvenance = JSON.parse(await readFile(packageProvenancePath, "utf8"));
  packageProvenance.generation_id = generationId;
  await files.writeJson(packageProvenancePath, packageProvenance);
  await rm(`${packageProvenancePath}.asc`, { force: true });
  await sign(packageProvenancePath, keyFingerprint, gpgHome);

  await files.writeJson(path.join(stage, "metadata/validation/image.json"), {
    metadata_version: "0.1.0",
    schema: 1,
    node_version: image.source_release,
    target: "centos-stream-10-x86_64",
    image: image.repository,
    tag: image.tag,
    digest: image.digest,
    base_image: image.base_image,
    base_image_digest: image.base_image_digest,
    smoke_test: "passed",
    registry_push: "passed",
    status: "passed",
    generated,
  });
  const provenancePath = imageRecord.provenance_path;
  const imageProvenancePath = path.join(stage, provenancePath);
  await mkdir(path.dirname(imageProvenancePath), { recursive: true });
  await files.writeJson(imageProvenancePath, {
    metadata_version: "0.1.0",
    schema: 1,
    generation_id: generationId,
    node_version: image.source_release,
    image: imageRecord,
    local_image_id: image.local_image_id,
    source_sha256: image.source_sha256,
    build: { base_image: image.base_image, base_image_digest: image.base_image_digest },
    validation_path: "metadata/validation/image.json",
    generated,
  });
  await sign(imageProvenancePath, keyFingerprint, gpgHome);
}

export default function imageEvidenceModule() {
  return { writeImageEvidence };
}
