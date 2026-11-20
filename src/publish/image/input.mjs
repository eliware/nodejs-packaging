import path from "node:path";
import { readFile } from "node:fs/promises";
import validateImageRecord from "./validation.mjs";
import loadImagePublicationSettings from "./settings.mjs";

export default async function loadImagePublicationInput(argv, env = process.env) {
  const { recordPath, repositoryRoot, keyFingerprint, gpgHome } = loadImagePublicationSettings(
    argv,
    env,
  );
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
