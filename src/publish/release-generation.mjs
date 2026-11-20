import { stat } from "node:fs/promises";
import path from "node:path";
import writeRepositoryIndex from "../generate/write-index.mjs";
import validatePublishedMetadata from "./validate-metadata.mjs";
import signReleaseRpm from "./sign/release-rpm.mjs";
import updateReleaseRecords from "./update-release/records.mjs";
import signRepositoryMetadata from "./sign/repository-metadata.mjs";
import updateReleaseCatalog from "./update-release/catalog.mjs";
import writeReleaseManifest from "./write-release-manifest.mjs";

export default async function prepareReleaseGeneration({
  stagingRoot,
  rpmName,
  generationId,
  keyFingerprint,
  gpgHome,
  run,
  files,
  validateMetadata = () => validatePublishedMetadata(stagingRoot),
}) {
  const rpmPath = path.join(stagingRoot, "el10/x86_64/stable", rpmName);
  await signReleaseRpm({ rpmPath, keyFingerprint, gpgHome, run });
  const rpmSha256 = await files.hashFile(rpmPath);
  const rpmSize = (await stat(rpmPath)).size;
  const { provenancePath } = await updateReleaseRecords({ stagingRoot, rpmSha256, rpmSize, files });
  await signRepositoryMetadata({
    stagingRoot,
    keyFingerprint,
    gpgHome,
    run,
    provenancePath,
  });
  await updateReleaseCatalog({ stagingRoot, rpmSha256, rpmSize, files });
  const active = {
    metadata_version: "0.1.0",
    schema: 1,
    generation: generationId,
    generated: new Date().toISOString(),
  };
  await files.writeJson(path.join(stagingRoot, "metadata/active-generation.json"), active);
  await files.writeJson(path.join(stagingRoot, "generation.json"), active);
  await writeReleaseManifest({ stagingRoot, keyFingerprint, gpgHome, files });
  await writeRepositoryIndex({
    directory: stagingRoot,
    generated: active.generated,
    excludedPath: "metadata/repository-index.json",
  });
  await validateMetadata();
  return { rpmSha256 };
}
