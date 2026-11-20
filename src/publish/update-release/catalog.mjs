import { readFile } from "node:fs/promises";
import path from "node:path";

export default async function updateReleaseCatalog({ stagingRoot, rpmSha256, rpmSize, files }) {
  const catalogPath = path.join(stagingRoot, "metadata/catalog.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  catalog.stable.latest.package.sha256 = rpmSha256;
  catalog.stable.latest.package.size = rpmSize;
  catalog.stable.items = catalog.stable.items.map((item) => ({
    ...item,
    package: { ...item.package, sha256: rpmSha256, size: rpmSize },
  }));
  await files.writeJson(catalogPath, catalog);
}
