import { expect, test } from "@jest/globals";
import loadReleaseInput from "../../../src/publish/release/input.mjs";

const fingerprint = "A".repeat(40);

test("parses and resolves publication inputs", () => {
  expect(
    loadReleaseInput(
      [
        "--version",
        "26.13.1",
        "--candidate",
        "/virtual/candidate",
        "--repository",
        "/virtual/repo",
      ],
      { NODEJS_SIGNING_KEY: fingerprint },
    ),
  ).toMatchObject({
    version: "26.13.1",
    candidateRoot: "/virtual/candidate",
    repositoryRoot: "/virtual/repo",
    keyFingerprint: fingerprint,
    gpgHome: "/var/lib/eliware/nodejs-signing/gnupg",
  });
});

test("rejects invalid versions, candidate paths, and signing keys", () => {
  expect(() => loadReleaseInput([], {})).toThrow("pass a stable Node.js 26 version");
  expect(() => loadReleaseInput(["--version", "27.0.0"], {})).toThrow(
    "pass a stable Node.js 26 version",
  );
  expect(() => loadReleaseInput(["--version", "26.13.1"], {})).toThrow(
    "pass a repository candidate",
  );
  expect(() => loadReleaseInput(["--version", "26.13.1", "--candidate", "/candidate"], {})).toThrow(
    "set NODEJS_SIGNING_KEY",
  );
});
