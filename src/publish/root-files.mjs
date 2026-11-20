import { mkdir } from "node:fs/promises";
import path from "node:path";
import atomicCopy from "./files/copy.mjs";

export default async function copyRootFiles({ repositoryRoot, generationRoot, rootFiles }) {
  for (const { source, destination } of rootFiles) {
    const destinationPath = path.join(repositoryRoot, destination);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await atomicCopy(path.join(generationRoot, source), destinationPath);
  }
}
