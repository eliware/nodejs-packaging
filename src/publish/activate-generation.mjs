import { cp, lstat, readlink, rename, rm } from "node:fs/promises";
import path from "node:path";
import copyRootFiles from "./root-files.mjs";

async function snapshotPointer(pointer, inspectPointer) {
  try {
    if ((await inspectPointer(pointer)).isSymbolicLink())
      return { type: "symlink", target: await readlink(pointer) };
    const backup = `${pointer}.rollback-${process.pid}`;
    await rm(backup, { recursive: true, force: true });
    await cp(pointer, backup, { recursive: true });
    return { type: "path", backup };
  } catch (error) {
    if (error.code === "ENOENT") return { type: "missing" };
    throw error;
  }
}

export default async function activateGeneration({
  repositoryRoot,
  generationRoot,
  files,
  rootFiles = [],
  inspectPointer = lstat,
}) {
  const metadataRoot = path.join(repositoryRoot, "metadata");
  const pointers = [
    [
      path.join(repositoryRoot, "el10/x86_64/stable"),
      path.join(generationRoot, "el10/x86_64/stable"),
    ],
    ...["provenance", "releases", "validation"].map((name) => [
      path.join(metadataRoot, name),
      path.join(generationRoot, "metadata", name),
    ]),
  ];
  const previous = [];
  for (const [pointer] of pointers) previous.push(await snapshotPointer(pointer, inspectPointer));
  try {
    for (const [pointer, target] of pointers) await files.replacePointer(pointer, target);
    await copyRootFiles({ repositoryRoot, generationRoot, rootFiles });
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
    for (const snapshot of previous)
      if (snapshot.type === "path") await rm(snapshot.backup, { recursive: true, force: true });
  } catch (error) {
    const rollbackErrors = [];
    for (let index = pointers.length - 1; index >= 0; index -= 1) {
      const [pointer] = pointers[index];
      const snapshot = previous[index];
      try {
        if (snapshot.type === "missing") await rm(pointer, { recursive: true, force: true });
        else if (snapshot.type === "symlink")
          await files.replacePointer(pointer, path.resolve(path.dirname(pointer), snapshot.target));
        else {
          await rm(pointer, { recursive: true, force: true });
          await rename(snapshot.backup, pointer);
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length)
      throw new AggregateError([error, ...rollbackErrors], "generation activation rollback failed");
    throw error;
  }
}
