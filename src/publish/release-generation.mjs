import { mkdir, readFile, stat, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import sign from "./sign.mjs";
import buildIndex from "../generate/index.mjs";
import validatePublishedMetadata from "./validate-metadata.mjs";

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
  const rpmDirectory = path.join(stagingRoot, "el10/x86_64/stable");
  const rpmPath = path.join(rpmDirectory, rpmName);
  await run("rpmsign", ["--addsign", "--define", `_gpg_name ${keyFingerprint}`, rpmPath], {
    GNUPGHOME: gpgHome,
  });
  const rpmSha256 = await files.hashFile(rpmPath);
  const releasePath = path.join(stagingRoot, "metadata/releases/nodejs26.json");
  const release = JSON.parse(await readFile(releasePath, "utf8"));
  release.package.sha256 = rpmSha256;
  release.package.size = (await stat(rpmPath)).size;
  await files.writeJson(releasePath, release);
  const provenancePath = path.join(stagingRoot, "metadata/provenance/package.json");
  const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
  provenance.package.sha256 = rpmSha256;
  provenance.package.size = release.package.size;
  await files.writeJson(provenancePath, provenance);

  const stablePath = path.join(stagingRoot, "el10/x86_64/stable");
  await rm(path.join(stablePath, "repodata"), { recursive: true, force: true });
  await run("createrepo_c", ["--checksum", "sha256", stablePath]);
  const publicKeyPath = path.join(stagingRoot, "keys/RPM-GPG-KEY-ELIWARE-NODEJS");
  await mkdir(path.dirname(publicKeyPath), { recursive: true });
  const publicKey = (
    await run("gpg", ["--batch", "--armor", "--export", keyFingerprint], {
      GNUPGHOME: gpgHome,
    })
  ).stdout;
  await writeFile(publicKeyPath, publicKey);
  await sign(path.join(stablePath, "repodata/repomd.xml"), keyFingerprint, gpgHome);
  await sign(provenancePath, keyFingerprint, gpgHome);

  const catalogPath = path.join(stagingRoot, "metadata/catalog.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  catalog.stable.latest.package.sha256 = rpmSha256;
  catalog.stable.latest.package.size = release.package.size;
  catalog.stable.items = catalog.stable.items.map((item) => ({
    ...item,
    package: { ...item.package, sha256: rpmSha256, size: release.package.size },
  }));
  await files.writeJson(catalogPath, catalog);
  const active = {
    metadata_version: "0.1.0",
    schema: 1,
    generation: generationId,
    generated: new Date().toISOString(),
  };
  await files.writeJson(path.join(stagingRoot, "metadata/active-generation.json"), active);
  await files.writeJson(path.join(stagingRoot, "generation.json"), active);

  const manifestPath = path.join(stagingRoot, "metadata/release-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.signed = true;
  manifest.publication_ready = true;
  manifest.catalog_sha256 = await files.hashFile(catalogPath);
  manifest.repository_metadata_sha256 = await files.hashFile(
    path.join(stablePath, "repodata/repomd.xml"),
  );
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
  await files.writeJson(path.join(stagingRoot, "metadata/repository-index.json"), {
    metadata_version: "0.1.0",
    schema: 1,
    generated: active.generated,
    directories: await buildIndex(stagingRoot, "/", "metadata/repository-index.json"),
  });
  await validateMetadata();
  return { rpmSha256 };
}
