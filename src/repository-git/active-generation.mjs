import path from "node:path";
import { readFile } from "node:fs/promises";

export default async function loadActiveGeneration(repositoryRoot, load = readFile) {
  const metadata = JSON.parse(
    await load(path.join(repositoryRoot, "metadata/active-generation.json"), "utf8"),
  );
  return metadata.generation;
}
