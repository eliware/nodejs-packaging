import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

async function pruneGenerations(repositoryRoot, activeGeneration, keep = 6) {
  const root = path.join(repositoryRoot, ".generations");
  const entries = await readdir(root, { withFileTypes: true });
  const generations = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    generations.push({
      name: entry.name,
      modified: (await stat(path.join(root, entry.name))).mtimeMs,
    });
  }
  generations.sort((left, right) => right.modified - left.modified);
  const retained = new Set([
    activeGeneration,
    ...generations.slice(0, keep).map(({ name }) => name),
  ]);
  for (const { name } of generations)
    if (!retained.has(name)) await rm(path.join(root, name), { recursive: true, force: true });
  return generations.filter(({ name }) => retained.has(name)).map(({ name }) => name);
}

export default function retentionModule() {
  return { pruneGenerations };
}
