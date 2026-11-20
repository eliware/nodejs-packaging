import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import publishFilesystemModule from "../filesystem.mjs";

const files = publishFilesystemModule();

export default async function assertSafeRepositoryPaths(repositoryRoot) {
  const stablePath = path.join(repositoryRoot, "el10/x86_64/stable");
  if (await files.exists(stablePath)) {
    const info = await lstat(stablePath);
    if (info.isDirectory() && (await readdir(stablePath)).length)
      throw new Error("stable repository path is not empty");
  }
  for (const name of ["provenance", "releases", "validation"]) {
    const publicPath = path.join(repositoryRoot, "metadata", name);
    if (await files.exists(publicPath)) {
      const info = await lstat(publicPath);
      if (info.isDirectory() && (await readdir(publicPath)).length)
        throw new Error(`metadata path is not empty: ${publicPath}`);
    }
  }
}
