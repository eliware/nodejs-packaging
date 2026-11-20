import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sign from "../sign.mjs";

export default async function signRepositoryMetadata({
  stagingRoot,
  keyFingerprint,
  gpgHome,
  run,
  provenancePath,
}) {
  const stablePath = path.join(stagingRoot, "el10/x86_64/stable");
  const repositoryMetadataPath = path.join(stablePath, "repodata/repomd.xml");
  await rm(path.dirname(repositoryMetadataPath), { recursive: true, force: true });
  await run("createrepo_c", ["--checksum", "sha256", stablePath]);
  const publicKeyPath = path.join(stagingRoot, "keys/RPM-GPG-KEY-ELIWARE-NODEJS");
  await mkdir(path.dirname(publicKeyPath), { recursive: true });
  const publicKey = (
    await run("gpg", ["--batch", "--armor", "--export", keyFingerprint], {
      GNUPGHOME: gpgHome,
    })
  ).stdout;
  await writeFile(publicKeyPath, publicKey);
  await sign(repositoryMetadataPath, keyFingerprint, gpgHome);
  await sign(provenancePath, keyFingerprint, gpgHome);
}
