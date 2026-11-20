import { readFile } from "node:fs/promises";
import path from "node:path";
import validateImageRecord from "./validation.mjs";

export default async function loadImagePublicationInput(argv, env = process.env) {
  const recordPath = path.resolve(argv[0] || "");
  if (!argv[0]) throw new Error("pass the published image record path");
  const keyFingerprint = env.NODEJS_SIGNING_KEY;
  if (!/^[A-F0-9]{40}$/.test(keyFingerprint || ""))
    throw new Error("set NODEJS_SIGNING_KEY to the signing key fingerprint");
  const repositoryRoot = path.resolve(env.NODEJS_REPOSITORY_ROOT || "/eliware/nodejs-repository");
  const gpgHome = path.resolve(env.NODEJS_GNUPGHOME || "/var/lib/eliware/nodejs-signing/gnupg");
  const image = validateImageRecord(JSON.parse(await readFile(recordPath, "utf8")));
  const oldActive = JSON.parse(
    await readFile(path.join(repositoryRoot, "metadata/active-generation.json"), "utf8"),
  );
  const oldRoot = path.join(repositoryRoot, ".generations", oldActive.generation);
  const catalog = JSON.parse(
    await readFile(path.join(repositoryRoot, "metadata/catalog.json"), "utf8"),
  );
  if (catalog.stable?.latest?.node_version !== image.source_release)
    throw new Error("image release does not match the published stable RPM");
  return { repositoryRoot, recordPath, keyFingerprint, gpgHome, image, oldRoot };
}
