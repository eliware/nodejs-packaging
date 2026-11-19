import { expect, test } from "@jest/globals";
import imageValidationModule from "../../../src/publish/image/validation.mjs";

const { validateImageRecord } = imageValidationModule();

test("accepts a passed image record with a registry digest", () => {
  const image = { validation: "passed", digest: `sha256:${"a".repeat(64)}` };
  expect(validateImageRecord(image)).toBe(image);
});

test("rejects failed validation and malformed registry digests", () => {
  expect(() =>
    validateImageRecord({ validation: "failed", digest: `sha256:${"a".repeat(64)}` }),
  ).toThrow("image record must contain a passed validation and registry digest");
  expect(() => validateImageRecord({ validation: "passed", digest: "sha256:bad" })).toThrow(
    "image record must contain a passed validation and registry digest",
  );
  expect(() => validateImageRecord({ validation: "passed" })).toThrow(
    "image record must contain a passed validation and registry digest",
  );
});
