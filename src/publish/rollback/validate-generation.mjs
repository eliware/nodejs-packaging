import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import validateGenerationId from "./generation-id.mjs";
import hashFile from "../files/hash.mjs";

export default async function validateGeneration(
  repositoryRoot,
  generation,
  load = readFile,
  dependencies = {},
) {
  validateGenerationId(generation);
  const root = path.join(repositoryRoot, ".generations", generation);
  const manifest = path.join(root, "metadata/release-manifest.json");
  const signature = `${manifest}.asc`;
  const active = JSON.parse(await load(path.join(root, "metadata/active-generation.json"), "utf8"));
  if (
    active.metadata_version !== "0.1.0" ||
    active.schema !== 1 ||
    active.generation !== generation
  )
    throw new Error("generation metadata does not match its directory");
  const record = JSON.parse(await load(manifest, "utf8"));
  if (
    record.metadata_version !== "0.1.0" ||
    record.schema !== 1 ||
    record.generation_id !== generation ||
    record.signed !== true ||
    record.publication_ready !== true ||
    !Array.isArray(record.files)
  )
    throw new Error("generation manifest is not publication ready");
  const hash = dependencies.hashFile || hashFile;
  const getStat = dependencies.stat || stat;
  for (const entry of record.files) {
    const relative = entry.path;
    const file = path.resolve(root, relative || "");
    if (
      typeof relative !== "string" ||
      relative.length === 0 ||
      path.isAbsolute(relative) ||
      path.relative(root, file).startsWith(`..${path.sep}`) ||
      path.relative(root, file) === ".."
    )
      throw new Error("generation manifest contains an invalid file path");
    if ((await hash(file)) !== entry.sha256 || (await getStat(file)).size !== entry.size)
      throw new Error(`generation file integrity check failed: ${relative}`);
  }
  const catalogHash = await hash(path.join(root, "metadata/catalog.json"));
  const repositoryHash = await hash(path.join(root, "el10/x86_64/stable/repodata/repomd.xml"));
  if (catalogHash !== record.catalog_sha256 || repositoryHash !== record.repository_metadata_sha256)
    throw new Error("generation metadata integrity check failed");
  return { root, manifest, signature };
}
