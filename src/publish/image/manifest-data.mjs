import path from "node:path";
import { readFile } from "node:fs/promises";

export default async function prepareImageManifest({
  stage,
  generationId,
  generated,
  files,
  load = readFile,
}) {
  const manifestPath = path.join(stage, "metadata/release-manifest.json");
  const manifest = JSON.parse(await load(manifestPath, "utf8"));
  manifest.generation_id = generationId;
  manifest.generated = generated;
  manifest.catalog_sha256 = await files.hashFile(path.join(stage, "metadata/catalog.json"));
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
  return { manifestPath, manifest };
}
