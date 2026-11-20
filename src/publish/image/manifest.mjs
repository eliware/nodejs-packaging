import sign from "../sign.mjs";
import prepareImageManifest from "./manifest-data.mjs";

export default async function writeImageManifest({
  stage,
  generationId,
  generated,
  keyFingerprint,
  gpgHome,
  files,
}) {
  const { manifestPath, manifest } = await prepareImageManifest({
    stage,
    generationId,
    generated,
    files,
  });
  await files.writeJson(manifestPath, manifest);
  await sign(manifestPath, keyFingerprint, gpgHome);
}
