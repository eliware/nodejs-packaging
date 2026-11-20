import { readFile } from "node:fs/promises";
import path from "node:path";

export default async function writeImageCatalog({
  stage,
  image,
  imageRecord,
  generationId,
  generated,
  files,
}) {
  const catalogPath = path.join(stage, "metadata/catalog.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const release = catalog.stable.latest;
  release.image = imageRecord;
  release.generation_id = generationId;
  release.generated = generated;
  catalog.stable.items = catalog.stable.items.map((item) =>
    item.node_version === image.source_release
      ? { ...item, image: imageRecord, generation_id: generationId, generated }
      : item,
  );
  const imageHistory = Array.isArray(catalog.images) ? catalog.images : [];
  catalog.images = [
    ...imageHistory.filter((item) => item.node_version !== image.source_release),
    {
      ...imageRecord,
      node_version: image.source_release,
      local_image_id: image.local_image_id,
      generated,
    },
  ];
  catalog.active_generation = generationId;
  catalog.generated = generated;
  await files.writeJson(catalogPath, catalog);
  await files.writeJson(path.join(stage, "metadata/releases/nodejs26.json"), release);
  return catalogPath;
}
