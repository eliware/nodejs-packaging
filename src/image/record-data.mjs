import path from "node:path";

export default function createImageRecordData({
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
}) {
  const record = {
    repository: target.image,
    tag: version,
    digest: registryDigest,
    published: pushImage,
    local_image_id: inspect.Id,
    base_image: baseImage,
    base_image_digest: baseDigest,
    source_release: version,
    source_sha256: sourceInput.source.sha256,
    rpm_sha256: publishedRelease.package.sha256,
    repository_generation: publishedRelease.generation_id,
    validation: "passed",
    built_at: new Date().toISOString(),
  };
  const resultDir = path.resolve(
    args.get("output") || path.join(root, "artifacts/images", version),
  );
  return { record, resultDir };
}
