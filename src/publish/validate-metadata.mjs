import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const names = [
  "catalog",
  "repository-index",
  "active-generation",
  "generation",
  "image-record",
  "release-manifest",
];
async function validatePublishedMetadata(
  root,
  {
    schemaRoot = path.resolve("config/schemas"),
    ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false }),
    readFileImpl = readFile,
  } = {},
) {
  const failures = [];
  for (const name of names) {
    const schema = JSON.parse(
      await readFileImpl(path.join(schemaRoot, `${name}.schema.json`), "utf8"),
    );
    const validator = ajv.compile(schema);
    const file =
      name === "catalog"
        ? "metadata/catalog.json"
        : name === "repository-index"
          ? "metadata/repository-index.json"
          : name === "active-generation"
            ? "metadata/active-generation.json"
            : name === "generation"
              ? "generation.json"
              : name === "release-manifest"
                ? "metadata/release-manifest.json"
                : "metadata/provenance/images/nodejs26-image.json";
    if (name === "image-record" && !(await exists(path.join(root, file), readFileImpl))) continue;
    const value = JSON.parse(await readFileImpl(path.join(root, file), "utf8"));
    if (!validator(value)) failures.push(`${file}: ${ajv.errorsText(validator.errors)}`);
  }
  if (failures.length)
    throw new Error(`published metadata schema validation failed: ${failures.join("; ")}`);
  return true;
}
async function exists(file, readFileImpl) {
  try {
    await readFileImpl(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
export default function validateMetadataModule() {
  return { validatePublishedMetadata };
}
