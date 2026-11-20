import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";
import imagePublicationFixture from "../../../test-fixtures/image-publication.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const setupImagePublication = imagePublicationFixture(fs);
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: loadImagePublicationInput } = await import("../../../src/publish/image/input.mjs");

test("requires a record path and a signing key", async () => {
  await expect(loadImagePublicationInput([], {})).rejects.toThrow(
    "pass the published image record path",
  );
  await expect(loadImagePublicationInput(["/virtual/image.json"], {})).rejects.toThrow(
    "set NODEJS_SIGNING_KEY to the signing key fingerprint",
  );
});

test("loads validated publication inputs and active repository state", async () => {
  const { root, oldRoot, recordPath } = await setupImagePublication();
  const result = await loadImagePublicationInput([recordPath], {
    ...process.env,
    NODEJS_GNUPGHOME: "/custom/gnupg",
  });
  expect(result).toEqual(
    expect.objectContaining({
      repositoryRoot: root,
      recordPath,
      keyFingerprint: "A".repeat(40),
      gpgHome: "/custom/gnupg",
      oldRoot,
      image: expect.objectContaining({ source_release: "26.13.1" }),
    }),
  );
});

test("uses the default repository root when no path is configured", async () => {
  const { recordPath } = await setupImagePublication();
  const root = "/eliware/nodejs-repository";
  await fs.mkdir(path.join(root, "metadata"), { recursive: true });
  await fs.writeFile(
    path.join(root, "metadata/active-generation.json"),
    JSON.stringify({ generation: "generation-default" }),
  );
  await fs.writeFile(
    path.join(root, "metadata/catalog.json"),
    JSON.stringify({ stable: { latest: { node_version: "26.13.1" } } }),
  );
  const result = await loadImagePublicationInput([recordPath], {
    NODEJS_SIGNING_KEY: "A".repeat(40),
  });
  expect(result.repositoryRoot).toBe(root);
  expect(result.oldRoot).toBe(path.join(root, ".generations/generation-default"));
});

test("rejects invalid image evidence and a mismatched stable release", async () => {
  const invalid = await setupImagePublication();
  await fs.writeFile(invalid.recordPath, JSON.stringify({ validation: "failed", digest: "bad" }));
  await expect(loadImagePublicationInput([invalid.recordPath])).rejects.toThrow(
    "image record must contain a passed validation and registry digest",
  );

  const malformed = await setupImagePublication();
  const image = JSON.parse(await fs.readFile(malformed.recordPath, "utf8"));
  image.digest = "";
  await fs.writeFile(malformed.recordPath, JSON.stringify(image));
  await expect(loadImagePublicationInput([malformed.recordPath])).rejects.toThrow(
    "image record must contain a passed validation and registry digest",
  );

  const mismatch = await setupImagePublication();
  const oldImage = JSON.parse(await fs.readFile(mismatch.recordPath, "utf8"));
  oldImage.source_release = "26.13.0";
  oldImage.tag = "26.13.0";
  await fs.writeFile(mismatch.recordPath, JSON.stringify(oldImage));
  await expect(loadImagePublicationInput([mismatch.recordPath])).rejects.toThrow(
    "image release does not match the published stable RPM",
  );
});
