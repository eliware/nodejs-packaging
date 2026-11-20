import path from "node:path";

export default async function validateImageRecord({ catalog, schemaRoot, ajv, readFileImpl }) {
  const image = catalog.stable?.latest?.image;
  if (!image) return null;
  const schema = JSON.parse(
    await readFileImpl(path.join(schemaRoot, "image-record.schema.json"), "utf8"),
  );
  const validator = (schema.$id && ajv.getSchema(schema.$id)) || ajv.compile(schema);
  if (!validator(image)) return `metadata/catalog.json: ${ajv.errorsText(validator.errors)}`;
  return null;
}
