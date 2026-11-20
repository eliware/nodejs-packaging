import { rename, rm } from "node:fs/promises";
import publishFilesystemModule from "../filesystem.mjs";
import writeImageRecords from "./records.mjs";
import writeImageManifest from "./manifest.mjs";
import writeRepositoryIndex from "../../generate/write-index.mjs";
import activateGeneration from "../activate-generation.mjs";
import loadImagePublicationInput from "./input.mjs";
import imageGeneration from "./generation.mjs";
import pruneGenerations from "../retention.mjs";
import writeImagePublicationOutput from "./result.mjs";
const files = publishFilesystemModule();
const { runImageGeneration } = imageGeneration();
export default async function main(argv = process.argv.slice(2), dependencies = {}) {
  const { repositoryRoot, keyFingerprint, gpgHome, image, oldRoot } =
    await loadImagePublicationInput(argv);

  const generated = new Date().toISOString();
  await runImageGeneration({
    repositoryRoot,
    oldRoot,
    image,
    generated,
    publish: async ({ generationId, stage, finalRoot, markActivationStarted }) => {
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
      markActivationStarted();
      try {
        await (dependencies.activateGeneration || activateGeneration)({
          repositoryRoot,
          generationRoot: finalRoot,
          files,
        });
      } catch (error) {
        if (!(error instanceof AggregateError))
          await rm(finalRoot, { recursive: true, force: true });
        throw error;
      }
      await pruneGenerations(repositoryRoot, generationId);
      writeImagePublicationOutput({ generationId, image: imageRecord });
    },
  });
}
