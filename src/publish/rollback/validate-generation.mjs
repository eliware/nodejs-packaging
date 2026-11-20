import path from "node:path";
import { readFile } from "node:fs/promises";

export default async function validateGeneration(repositoryRoot, generation, load = readFile) {
  if (!/^node-v26\.[0-9]+\.[0-9]+-el10-x86_64-[0-9]+$/.test(generation || ""))
    throw new Error("pass a retained stable generation identifier");
  const root = path.join(repositoryRoot, ".generations", generation);
  const manifest = path.join(root, "metadata/release-manifest.json");
  const signature = `${manifest}.asc`;
  const active = JSON.parse(await load(path.join(root, "metadata/active-generation.json"), "utf8"));
  if (active.generation !== generation)
    throw new Error("generation metadata does not match its directory");
  return { root, manifest, signature };
}
