import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import signModule from "../sign.mjs";

const { sign } = signModule();

async function writeImageRecords({
  stage,
  image,
  generationId,
  generated,
  keyFingerprint,
  gpgHome,
  files,
}) {
  const catalogPath = path.join(stage, "metadata/catalog.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const release = catalog.stable.latest;
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
  release.image = imageRecord;
  release.generation_id = generationId;
  release.generated = generated;
  catalog.stable.items = catalog.stable.items.map((item) => ({
    ...item,
    image: imageRecord,
    generation_id: generationId,
    generated,
  }));
  catalog.images = [
    {
      ...imageRecord,
      node_version: image.source_release,
      local_image_id: image.local_image_id,
      generated,
    },
  ];
  catalog.active_generation = generationId;
  catalog.generated = generated;
  await files.writeJson(catalogPath, catalog);
  await files.writeJson(path.join(stage, "metadata/releases/nodejs26.json"), release);

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
  const active = { metadata_version: "0.1.0", schema: 1, generation: generationId, generated };
  await files.writeJson(path.join(stage, "metadata/active-generation.json"), active);
  await files.writeJson(path.join(stage, "generation.json"), active);
  return { imageRecord, catalogPath };
}

export default function imageRecordsModule() {
  return { writeImageRecords };
}
