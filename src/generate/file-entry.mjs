import { stat } from "node:fs/promises";
import generateFilesModule from "./files.mjs";

const { hashFile } = generateFilesModule();

export default async function createFileEntry({ entry, file, relative, statFile = stat }) {
  const info = await statFile(file);
  const isDirectory = info.isDirectory();
  const item = {
    name: entry.name,
    type: isDirectory ? "directory" : "file",
    size: isDirectory ? null : info.size,
    modified: info.mtime.toISOString(),
    href: `${relative}${encodeURIComponent(entry.name)}${isDirectory ? "/" : ""}`,
  };
  if (!isDirectory) item.sha256 = await hashFile(file);
  return item;
}
