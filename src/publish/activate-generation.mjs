import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

async function activateGeneration({ repositoryRoot, generationRoot, files, rootFiles = [] }) {
  await files.replacePointer(
    path.join(repositoryRoot, "el10/x86_64/stable"),
    path.join(generationRoot, "el10/x86_64/stable"),
  );
  const metadataRoot = path.join(repositoryRoot, "metadata");
  for (const name of ["provenance", "releases", "validation"])
    await files.replacePointer(
      path.join(metadataRoot, name),
      path.join(generationRoot, "metadata", name),
    );
  for (const { source, destination } of rootFiles) {
    const destinationPath = path.join(repositoryRoot, destination);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await cp(path.join(generationRoot, source), destinationPath);
  }
  for (const name of [
    "catalog.json",
    "repository-index.json",
    "release-manifest.json",
    "release-manifest.json.asc",
    "active-generation.json",
  ])
    await files.atomicCopy(
      path.join(generationRoot, "metadata", name),
      path.join(metadataRoot, name),
    );
}

export default function activateGenerationModule() {
  return { activateGeneration };
}
