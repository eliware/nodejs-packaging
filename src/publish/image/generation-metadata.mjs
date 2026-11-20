import path from "node:path";

export default async function writeImageGenerationMetadata({
  stage,
  generationId,
  generated,
  files,
}) {
  const active = { metadata_version: "0.1.0", schema: 1, generation: generationId, generated };
  await files.writeJson(path.join(stage, "metadata/active-generation.json"), active);
  await files.writeJson(path.join(stage, "generation.json"), active);
  return active;
}
