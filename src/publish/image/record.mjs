import { cp, mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import publishFilesystemModule from "../filesystem.mjs";
import writeImageRecords from "./records.mjs";
import sign from "../sign.mjs";
import buildIndex from "../../generate/index.mjs";
import activateGeneration from "../activate-generation.mjs";
import loadImagePublicationInput from "./input.mjs";
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
  const logDirectory = process.env.NODEJS_CONDUCTOR_LOG_DIR;
  const runId = process.env.NODEJS_CONDUCTOR_RUN_ID;
  if (logDirectory && runId)
    await cp(logDirectory, path.join(stage, "metadata/logs", runId), {
      recursive: true,
      force: true,
    });

  let activationStarted = false;
  try {
    const { imageRecord, catalogPath } = await writeImageRecords({
      stage,
      image,
      generationId,
      generated,
      keyFingerprint,
      gpgHome,
      files,
    });

    const manifestPath = path.join(stage, "metadata/release-manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.generation_id = generationId;
    manifest.generated = generated;
    manifest.catalog_sha256 = await files.hashFile(catalogPath);
    manifest.repository_metadata_sha256 = await files.hashFile(
      path.join(stage, "el10/x86_64/stable/repodata/repomd.xml"),
    );
    manifest.files = await files.listFiles(
      stage,
      new Set([
        "metadata/release-manifest.json",
        "metadata/release-manifest.json.asc",
        "metadata/repository-index.json",
      ]),
    );
    await files.writeJson(manifestPath, manifest);
    await sign(manifestPath, keyFingerprint, gpgHome);
    const indexPath = path.join(stage, "metadata/repository-index.json");
    await files.writeJson(indexPath, {
      metadata_version: "0.1.0",
      schema: 1,
      generated,
      directories: await buildIndex(stage, "/", "metadata/repository-index.json"),
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
