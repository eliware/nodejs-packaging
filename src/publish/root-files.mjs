import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

export default async function copyRootFiles({ repositoryRoot, generationRoot, rootFiles }) {
  for (const { source, destination } of rootFiles) {
    const destinationPath = path.join(repositoryRoot, destination);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await cp(path.join(generationRoot, source), destinationPath);
  }
}
