import { readFile } from "node:fs/promises";
import path from "node:path";
import sign from "./sign.mjs";

export default async function writeReleaseManifest({
  stagingRoot,
  keyFingerprint,
  gpgHome,
  files,
}) {
  const catalogPath = path.join(stagingRoot, "metadata/catalog.json");
  const repositoryMetadataPath = path.join(stagingRoot, "el10/x86_64/stable/repodata/repomd.xml");
  const manifestPath = path.join(stagingRoot, "metadata/release-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.signed = true;
  manifest.publication_ready = true;
  manifest.catalog_sha256 = await files.hashFile(catalogPath);
  manifest.repository_metadata_sha256 = await files.hashFile(repositoryMetadataPath);
  manifest.files = await files.listFiles(
    stagingRoot,
    new Set([
      "metadata/release-manifest.json",
      "metadata/release-manifest.json.asc",
      "metadata/repository-index.json",
    ]),
  );
  await files.writeJson(manifestPath, manifest);
  await sign(manifestPath, keyFingerprint, gpgHome);
}
