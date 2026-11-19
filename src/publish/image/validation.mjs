function validateImageRecord(image) {
  if (image.validation !== "passed" || !/^sha256:[a-f0-9]{64}$/.test(image.digest || ""))
    throw new Error("image record must contain a passed validation and registry digest");
  return image;
}

export default function imageValidationModule() {
  return { validateImageRecord };
}
