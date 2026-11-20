import { expect, test } from "@jest/globals";
import validateGenerationId from "../../../src/publish/rollback/generation-id.mjs";

test("accepts and returns a retained stable generation identifier", () => {
  const generation = "node-v26.1.2-el10-x86_64-20261120112233";
  expect(validateGenerationId(generation)).toBe(generation);
});

test("rejects missing and invalid generation identifiers", () => {
  expect(() => validateGenerationId()).toThrow("retained stable generation identifier");
  expect(() => validateGenerationId("seed")).toThrow("retained stable generation identifier");
});
