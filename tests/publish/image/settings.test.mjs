import { expect, test } from "@jest/globals";
import path from "node:path";
import loadImagePublicationSettings from "../../../src/publish/image/settings.mjs";

const fingerprint = "A".repeat(40);

test("resolves image record and signing settings", () => {
  const recordPath = path.resolve("/virtual/image.json");
  const repositoryRoot = path.resolve("/virtual/repository");
  const gpgHome = path.resolve("/virtual/gnupg");
  expect(
    loadImagePublicationSettings([recordPath], {
      NODEJS_SIGNING_KEY: fingerprint,
      NODEJS_REPOSITORY_ROOT: repositoryRoot,
      NODEJS_GNUPGHOME: gpgHome,
    }),
  ).toEqual({
    recordPath,
    repositoryRoot,
    keyFingerprint: fingerprint,
    gpgHome,
  });
});

test("requires a record path and valid signing key", () => {
  expect(() => loadImagePublicationSettings([], {})).toThrow(
    "pass the published image record path",
  );
  expect(() => loadImagePublicationSettings(["/image.json"], {})).toThrow(
    "set NODEJS_SIGNING_KEY to the signing key fingerprint",
  );
});
