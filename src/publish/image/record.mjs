import { cp, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import publishFilesystemModule from "../filesystem.mjs";
import writeImageRecords from "./records.mjs";
import writeImageManifest from "./manifest.mjs";
import writeRepositoryIndex from "../../generate/write-index.mjs";
import activateGeneration from "../activate-generation.mjs";
import loadImagePublicationInput from "./input.mjs";
import copyConductorLogs from "./logs.mjs";
import pruneGenerations from "../retention.mjs";
const files = publishFilesystemModule();
export default async function main(argv = process.argv.slice(2), dependencies = {}) {
  const { repositoryRoot, keyFingerprint, gpgHome, image, oldRoot } =
    await loadImagePublicationInput(argv);

  const generated = new Date().toISOString();
  const stamp = generated.replace(/[-:.TZ]/g, "");
  const generationId = `node-v${image.source_release}-el10-x86_64-${stamp}`;
  const stage = path.join(repositoryRoot, ".generations", `.staging-${generationId}`);
  const finalRoot = path.join(repositoryRoot, ".generations", generationId);
  if ((await files.exists(finalRoot)) || (await files.exists(stage)))
    throw new Error(`generation already exists: ${generationId}`);
  await mkdir(path.dirname(stage), { recursive: true });
  await cp(oldRoot, stage, { recursive: true });
  await copyConductorLogs(stage);

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
    await rm(stage, { recursive: true, force: true });
    if (!activationStarted) await rm(finalRoot, { recursive: true, force: true });
    throw error;
  }
}
