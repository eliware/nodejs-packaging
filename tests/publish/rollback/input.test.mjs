import path from "node:path";
import { expect, test } from "@jest/globals";
import resolveRollbackInput from "../../../src/publish/rollback/input.mjs";

test("resolves rollback options and repository root", () => {
  const keyFingerprint = "A".repeat(40);
  expect(
    resolveRollbackInput(["--generation", "node-v26.1.2-el10-x86_64-20261120112233"], {
      NODEJS_REPOSITORY_ROOT: "/virtual/repository",
      NODEJS_SIGNING_KEY: keyFingerprint,
    }),
  ).toEqual({
    generation: "node-v26.1.2-el10-x86_64-20261120112233",
    keyFingerprint,
    gpgHome: path.resolve("/var/lib/eliware/nodejs-signing/gnupg"),
    root: path.resolve("/virtual/repository"),
  });
  expect(() => resolveRollbackInput([], { NODEJS_SIGNING_KEY: keyFingerprint })).toThrow(
    "retained stable generation identifier",
  );
  expect(() =>
    resolveRollbackInput(["--generation", "bad"], { NODEJS_SIGNING_KEY: keyFingerprint }),
  ).toThrow("retained stable generation identifier");
  expect(() =>
    resolveRollbackInput(["--generation", "node-v26.1.2-el10-x86_64-20261120112233"], {}),
  ).toThrow("trusted release signing fingerprint");
});
