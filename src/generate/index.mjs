import path from "node:path";
import scanDirectory from "./scan-directory.mjs";

export default async function buildIndex(
  directory,
  relative = "/",
  excludedPath = "",
  relativeFs = "",
) {
  const items = await scanDirectory(directory, relative, excludedPath, relativeFs);
  const directories = { [relative]: { path: relative, entries: items, total: items.length } };
  for (const item of items.filter((value) => value.type === "directory"))
    Object.assign(
      directories,
      await buildIndex(
        path.join(directory, item.name),
        `${relative}${encodeURIComponent(item.name)}/`,
        excludedPath,
        relativeFs ? `${relativeFs}/${item.name}` : item.name,
      ),
    );
  return directories;
}
