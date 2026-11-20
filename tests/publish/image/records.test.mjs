import { expect, jest, test } from "@jest/globals";

const writeImageCatalog = jest.fn(async () => "/stage/metadata/catalog.json");
const writeImageEvidence = jest.fn(async () => {});
jest.unstable_mockModule("../../../src/publish/image/catalog.mjs", () => ({
  default: writeImageCatalog,
}));
jest.unstable_mockModule("../../../src/publish/image/evidence.mjs", () => ({
  default: writeImageEvidence,
}));
const { default: writeImageRecords } = await import("../../../src/publish/image/records.mjs");

test("coordinates catalog and evidence writers for an image release", async () => {
  writeImageCatalog.mockClear();
  writeImageEvidence.mockClear();
  const input = {
    stage: "/stage",
    image: { source_release: "26.13.1", repository: "ghcr.io/eliware/node", tag: "26.13.1" },
    generationId: "generation-1",
    generated: "2026-11-19T12:00:00.000Z",
    keyFingerprint: "A".repeat(40),
    gpgHome: "/keys",
    files: { writeJson: jest.fn() },
  };
  await expect(writeImageRecords(input)).resolves.toMatchObject({
    catalogPath: "/stage/metadata/catalog.json",
    imageRecord: expect.objectContaining({
      repository: input.image.repository,
      tag: input.image.tag,
      validation: "passed",
      provenance_path: "metadata/provenance/images/nodejs26-26.13.1.json",
    }),
  });
  expect(writeImageCatalog).toHaveBeenCalledWith(
    expect.objectContaining({
      stage: input.stage,
      image: input.image,
      generationId: input.generationId,
    }),
  );
  expect(writeImageEvidence).toHaveBeenCalledWith(
    expect.objectContaining({
      stage: input.stage,
      image: input.image,
      generationId: input.generationId,
    }),
  );
});
