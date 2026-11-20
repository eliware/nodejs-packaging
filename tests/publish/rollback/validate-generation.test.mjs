import { expect, test } from "@jest/globals";
import validateGeneration from "../../../src/publish/rollback/validate-generation.mjs";

const generation = "node-v26.1.2-el10-x86_64-20261120112233";

test("validates and resolves a retained generation", async () => {
  const load = async () => JSON.stringify({ generation });
  await expect(validateGeneration("/virtual/rollback", generation, load)).resolves.toEqual({
    root: `/virtual/rollback/.generations/${generation}`,
    manifest: `/virtual/rollback/.generations/${generation}/metadata/release-manifest.json`,
    signature: `/virtual/rollback/.generations/${generation}/metadata/release-manifest.json.asc`,
  });
});

test("rejects invalid identifiers and mismatched metadata", async () => {
  await expect(validateGeneration("/virtual/rollback")).rejects.toThrow(
    "retained stable generation identifier",
  );
  await expect(validateGeneration("/virtual/rollback", "seed")).rejects.toThrow(
    "retained stable generation identifier",
  );
  await expect(
    validateGeneration("/virtual/rollback", generation, async () =>
      JSON.stringify({ generation: "another" }),
    ),
  ).rejects.toThrow("generation metadata does not match its directory");
});
