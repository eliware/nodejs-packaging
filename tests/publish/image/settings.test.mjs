import { expect, test } from "@jest/globals";
import loadImagePublicationSettings from "../../../src/publish/image/settings.mjs";

const fingerprint = "A".repeat(40);

test("resolves image record and signing settings", () => {
  expect(
    loadImagePublicationSettings(["/virtual/image.json"], {
      NODEJS_SIGNING_KEY: fingerprint,
      NODEJS_REPOSITORY_ROOT: "/virtual/repository",
      NODEJS_GNUPGHOME: "/virtual/gnupg",
    }),
  ).toEqual({
    recordPath: "/virtual/image.json",
    repositoryRoot: "/virtual/repository",
    keyFingerprint: fingerprint,
    gpgHome: "/virtual/gnupg",
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
