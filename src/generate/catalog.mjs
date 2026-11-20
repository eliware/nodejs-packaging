import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export default async function writeCatalogMetadata({
  candidate,
  root,
  generationId,
  generated,
  releaseRecord,
}) {
  const catalog = JSON.parse(
    await readFile(path.join(root, "templates/catalog.seed.json"), "utf8"),
  );
  catalog.generated = generated;
  catalog.active_generation = generationId;
  catalog.stable = { available: true, latest: releaseRecord, items: [releaseRecord] };
  await mkdir(path.join(candidate, "metadata"), { recursive: true });
  await writeFile(
    path.join(candidate, "metadata/catalog.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
  await writeFile(
    path.join(candidate, "generation.json"),
    `${JSON.stringify(
      { metadata_version: "0.1.0", schema: 1, generation: generationId, generated },
      null,
      2,
    )}\n`,
  );
}
