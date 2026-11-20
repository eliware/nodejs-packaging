import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import writeImageGenerationMetadata from "../../../src/publish/image/generation-metadata.mjs";

test("writes active and root generation markers", async () => {
  const files = { writeJson: jest.fn(async () => {}) };
  const generated = "2026-11-20T00:00:00.000Z";
  const active = await writeImageGenerationMetadata({
    stage: "/virtual/image-stage",
    generationId: "generation-1",
    generated,
    files,
  });
  expect(active).toEqual({
    metadata_version: "0.1.0",
    schema: 1,
    generation: "generation-1",
    generated,
  });
  expect(files.writeJson).toHaveBeenNthCalledWith(
    1,
    path.join("/virtual/image-stage", "metadata/active-generation.json"),
    active,
  );
  expect(files.writeJson).toHaveBeenNthCalledWith(
    2,
    path.join("/virtual/image-stage", "generation.json"),
    active,
  );
});
