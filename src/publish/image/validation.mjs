function validateImageRecord(image) {
  const checksum = /^[a-f0-9]{64}$/;
  const valid =
    image !== null &&
    typeof image === "object" &&
    image.validation === "passed" &&
    image.published === true &&
    typeof image.repository === "string" &&
    image.repository.length > 0 &&
    typeof image.tag === "string" &&
    /^26\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(image.tag) &&
    image.source_release === image.tag &&
    /^sha256:[a-f0-9]{64}$/.test(image.digest || "") &&
    typeof image.base_image === "string" &&
    image.base_image.length > 0 &&
    typeof image.base_image_digest === "string" &&
    image.base_image_digest.length > 0 &&
    checksum.test(image.rpm_sha256 || "") &&
    checksum.test(image.source_sha256 || "") &&
    typeof image.local_image_id === "string" &&
    image.local_image_id.length > 0 &&
    typeof image.repository_generation === "string" &&
    image.repository_generation.length > 0;
  if (!valid) throw new Error("image record must contain a passed validation and registry digest");
  return image;
}

export default function imageValidationModule() {
  return { validateImageRecord };
}
