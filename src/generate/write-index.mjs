import { writeFile } from "node:fs/promises";
import path from "node:path";
import buildIndex from "./index.mjs";

export default async function writeRepositoryIndex({
  directory,
  generated,
  relative = "/",
  excludedPath = "",
}) {
  const document = {
    metadata_version: "0.1.0",
    schema: 1,
    generated,
    directories: await buildIndex(directory, relative, excludedPath),
  };
  await writeFile(
    path.join(directory, "metadata/repository-index.json"),
    `${JSON.stringify(document, null, 2)}\n`,
  );
  return document;
}
