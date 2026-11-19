import { cp, mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import publishFilesystemModule from "../filesystem.mjs";
import imageRecordsModule from "./records.mjs";
const files = publishFilesystemModule();
const { writeImageRecords } = imageRecordsModule();

async function main(argv = process.argv.slice(2)) {
  const repositoryRoot = path.resolve(
    process.env.NODEJS_REPOSITORY_ROOT || "/eliware/nodejs-repository",
  );
  const recordPath = path.resolve(argv[0] || "");
  const keyFingerprint = process.env.NODEJS_SIGNING_KEY;
  const gpgHome = path.resolve(
    process.env.NODEJS_GNUPGHOME || "/var/lib/eliware/nodejs-signing/gnupg",
  );
  if (!argv[0]) throw new Error("pass the published image record path");
  if (!/^[A-F0-9]{40}$/.test(keyFingerprint || ""))
    throw new Error("set NODEJS_SIGNING_KEY to the signing key fingerprint");

  const image = JSON.parse(await readFile(recordPath, "utf8"));
  if (image.validation !== "passed" || !/^sha256:[a-f0-9]{64}$/.test(image.digest || ""))
    throw new Error("image record must contain a passed validation and registry digest");
  const oldActive = JSON.parse(
    await readFile(path.join(repositoryRoot, "metadata/active-generation.json"), "utf8"),
  );
  const oldRoot = path.join(repositoryRoot, ".generations", oldActive.generation);
  const catalog = JSON.parse(
    await readFile(path.join(repositoryRoot, "metadata/catalog.json"), "utf8"),
  );
  if (catalog.stable?.latest?.node_version !== image.source_release)
    throw new Error("image release does not match the published stable RPM");

  const generated = new Date().toISOString();
  const stamp = generated.replace(/[-:.TZ]/g, "");
  const generationId = `node-v${image.source_release}-el10-x86_64-${stamp}`;
  const stage = path.join(repositoryRoot, ".generations", `.staging-${generationId}`);
  const finalRoot = path.join(repositoryRoot, ".generations", generationId);
  if ((await files.exists(finalRoot)) || (await files.exists(stage)))
    throw new Error(`generation already exists: ${generationId}`);
  await mkdir(path.dirname(stage), { recursive: true });
  await cp(oldRoot, stage, { recursive: true });

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
    await files.sign(manifestPath, keyFingerprint, gpgHome);
    const indexPath = path.join(stage, "metadata/repository-index.json");
    await files.writeJson(indexPath, {
      metadata_version: "0.1.0",
      schema: 1,
      generated,
      directories: await files.buildIndex(stage, "/", "metadata/repository-index.json"),
    });

    await rename(stage, finalRoot);
    await files.replacePointer(
      path.join(repositoryRoot, "el10/x86_64/stable"),
      path.join(finalRoot, "el10/x86_64/stable"),
    );
    const metadataRoot = path.join(repositoryRoot, "metadata");
    for (const name of ["provenance", "releases", "validation"])
      await files.replacePointer(
        path.join(metadataRoot, name),
        path.join(finalRoot, "metadata", name),
      );
    for (const name of [
      "catalog.json",
      "repository-index.json",
      "release-manifest.json",
      "release-manifest.json.asc",
    ])
      await files.atomicCopy(path.join(finalRoot, "metadata", name), path.join(metadataRoot, name));
    await files.atomicCopy(
      path.join(finalRoot, "metadata/active-generation.json"),
      path.join(metadataRoot, "active-generation.json"),
    );
    process.stdout.write(
      `${JSON.stringify({ generation: generationId, image: imageRecord }, null, 2)}\n`,
    );
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
}

export default function moduleApi() {
  return { main };
}
