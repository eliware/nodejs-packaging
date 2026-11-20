import { rename } from "node:fs/promises";
import publishFilesystemModule from "../filesystem.mjs";
import writeImageRecords from "./records.mjs";
import writeImageManifest from "./manifest.mjs";
import writeRepositoryIndex from "../../generate/write-index.mjs";
import activateGeneration from "../activate-generation.mjs";
import loadImagePublicationInput from "./input.mjs";
import imageGeneration from "./generation.mjs";
import pruneGenerations from "../retention.mjs";
const files = publishFilesystemModule();
const { stageImageGeneration, cleanupImageGeneration } = imageGeneration();
export default async function main(argv = process.argv.slice(2), dependencies = {}) {
  const { repositoryRoot, keyFingerprint, gpgHome, image, oldRoot } =
    await loadImagePublicationInput(argv);

  const generated = new Date().toISOString();
  const { generationId, stage, finalRoot } = await stageImageGeneration({
    repositoryRoot,
    oldRoot,
    image,
    generated,
  });

  let activationStarted = false;
  try {
    const { imageRecord } = await writeImageRecords({
      stage,
      image,
      generationId,
      generated,
      keyFingerprint,
      gpgHome,
      files,
    });

    await writeImageManifest({ stage, generationId, generated, keyFingerprint, gpgHome, files });
    await writeRepositoryIndex({
      directory: stage,
      generated,
      excludedPath: "metadata/repository-index.json",
    });

    await rename(stage, finalRoot);
    activationStarted = true;
    await (dependencies.activateGeneration || activateGeneration)({
      repositoryRoot,
      generationRoot: finalRoot,
      files,
    });
    await pruneGenerations(repositoryRoot, generationId);
    process.stdout.write(
      `${JSON.stringify({ generation: generationId, image: imageRecord }, null, 2)}\n`,
    );
  } catch (error) {
    await cleanupImageGeneration({ stage, finalRoot, activationStarted });
    throw error;
  }
}
