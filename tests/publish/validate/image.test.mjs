import Ajv2020 from "ajv/dist/2020.js";
import { expect, jest, test } from "@jest/globals";
import validateImageRecord from "../../../src/publish/validate/image.mjs";

const schema = { type: "object", required: ["ready"] };
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
const readFileImpl = jest.fn(async () => JSON.stringify(schema));
const input = { schemaRoot: "/schemas", ajv, readFileImpl };

test("skips validation when the catalog has no image record", async () => {
  await expect(
    validateImageRecord({ ...input, catalog: { stable: { latest: {} } } }),
  ).resolves.toBe(null);
  expect(readFileImpl).not.toHaveBeenCalled();
});

test("validates image records and reports schema failures", async () => {
  await expect(
    validateImageRecord({
      ...input,
      catalog: { stable: { latest: { image: { ready: true } } } },
    }),
  ).resolves.toBeNull();
  await expect(
    validateImageRecord({
      ...input,
      catalog: { stable: { latest: { image: {} } } },
    }),
  ).resolves.toContain("metadata/catalog.json:");
});
