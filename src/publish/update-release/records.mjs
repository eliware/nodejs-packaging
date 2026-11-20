import { readFile } from "node:fs/promises";
import path from "node:path";

export default async function updateReleaseRecords({ stagingRoot, rpmSha256, rpmSize, files }) {
  const releasePath = path.join(stagingRoot, "metadata/releases/nodejs26.json");
  const release = JSON.parse(await readFile(releasePath, "utf8"));
  release.package.sha256 = rpmSha256;
  release.package.size = rpmSize;
  await files.writeJson(releasePath, release);
  const provenancePath = path.join(stagingRoot, "metadata/provenance/package.json");
  const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
  provenance.package.sha256 = rpmSha256;
  provenance.package.size = rpmSize;
  await files.writeJson(provenancePath, provenance);
  return { provenancePath };
}
