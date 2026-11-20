import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import validateImageRecord from "./image.mjs";

const names = [
  "catalog",
  "repository-index",
  "active-generation",
  "generation",
  "release-manifest",
];
export default async function validatePublishedMetadata(
  root,
  {
    schemaRoot = path.resolve("config/schemas"),
    ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false }),
    readFileImpl = readFile,
  } = {},
) {
  const imageSchema = JSON.parse(
    await readFileImpl(path.join(schemaRoot, "image-record.schema.json"), "utf8"),
  );
  if (imageSchema.$id && !ajv.getSchema(imageSchema.$id)) ajv.addSchema(imageSchema);
  const failures = [];
  for (const name of names) {
    const schema = JSON.parse(
      await readFileImpl(path.join(schemaRoot, `${name}.schema.json`), "utf8"),
    );
    const validator = ajv.compile(schema);
    const file = {
      catalog: "metadata/catalog.json",
      "repository-index": "metadata/repository-index.json",
      "active-generation": "metadata/active-generation.json",
      generation: "generation.json",
      "release-manifest": "metadata/release-manifest.json",
    }[name];
    const value = JSON.parse(await readFileImpl(path.join(root, file), "utf8"));
    if (!validator(value)) failures.push(`${file}: ${ajv.errorsText(validator.errors)}`);
  }
  const catalog = JSON.parse(await readFileImpl(path.join(root, "metadata/catalog.json"), "utf8"));
  const imageFailure = await validateImageRecord({ catalog, schemaRoot, ajv, readFileImpl });
  if (imageFailure) failures.push(imageFailure);
  if (failures.length)
    throw new Error(`published metadata schema validation failed: ${failures.join("; ")}`);
  return true;
}
