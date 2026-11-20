export default function createImageRecord(image) {
  const runId = process.env.NODEJS_CONDUCTOR_RUN_ID;
  return {
    repository: image.repository,
    tag: image.tag,
    digest: image.digest,
    base_image: image.base_image,
    base_image_digest: image.base_image_digest,
    rpm_sha256: image.rpm_sha256,
    validation: "passed",
    provenance_path: `metadata/provenance/images/nodejs26-${image.source_release}.json`,
    ...(runId ? { logs_path: `metadata/logs/${runId}/` } : {}),
  };
}
