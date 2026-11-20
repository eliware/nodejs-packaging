import { expect, jest, test } from "@jest/globals";
import verifyGenerationSignature from "../../../src/publish/rollback/verify-signature.mjs";

const keyFingerprint = "A".repeat(40);
const gpgHome = "/virtual/trusted-keys";
const validStatus = `[GNUPG:] VALIDSIG ${keyFingerprint} 2026-01-01 1 0 4 0 1 10 ${keyFingerprint}\n`;
const options = { gpgHome, keyFingerprint };

test("verifies the signed manifest in the trusted key home", () => {
  const run = jest.fn(() => ({ status: 0, stdout: validStatus }));
  verifyGenerationSignature("manifest.asc", "manifest.json", { ...options, run });
  expect(run).toHaveBeenCalledWith(
    "gpg",
    ["--batch", "--homedir", gpgHome, "--status-fd=1", "--verify", "manifest.asc", "manifest.json"],
    { encoding: "utf8" },
  );
});

test("accepts the signer fingerprint when GnuPG omits a primary fingerprint", () => {
  const run = jest.fn(() => ({
    status: 0,
    stdout: `[GNUPG:] VALIDSIG ${keyFingerprint} 2026-01-01 1 0 4 0 1 10\n`,
  }));
  expect(() =>
    verifyGenerationSignature("manifest.asc", "manifest.json", { ...options, run }),
  ).not.toThrow();
});

test("rejects missing trust settings, process errors, invalid signatures, and untrusted signers", () => {
  expect(() => verifyGenerationSignature("manifest.asc", "manifest.json", {})).toThrow(
    "trusted release signing fingerprint is required",
  );
  expect(() =>
    verifyGenerationSignature("manifest.asc", "manifest.json", {
      ...options,
      run: () => ({ error: new Error("spawn failed") }),
    }),
  ).toThrow("spawn failed");
  expect(() =>
    verifyGenerationSignature("manifest.asc", "manifest.json", {
      ...options,
      run: () => ({ status: 1 }),
    }),
  ).toThrow("unknown error");
  expect(() =>
    verifyGenerationSignature("manifest.asc", "manifest.json", {
      ...options,
      run: () => ({ status: 1, stderr: "bad signature" }),
    }),
  ).toThrow("bad signature");
  expect(() =>
    verifyGenerationSignature("manifest.asc", "manifest.json", {
      ...options,
      run: () => ({ status: 0, stdout: `[GNUPG:] VALIDSIG ${"B".repeat(40)}\n` }),
    }),
  ).toThrow("not made by the trusted release signing key");
  expect(() =>
    verifyGenerationSignature("manifest.asc", "manifest.json", {
      ...options,
      run: () => ({
        status: 0,
        stdout: `[GNUPG:] VALIDSIG ${keyFingerprint} 2026-01-01 1 0 4 0 1 10 00 00\n`,
      }),
    }),
  ).toThrow("not made by the trusted release signing key");
  expect(() =>
    verifyGenerationSignature("manifest.asc", "manifest.json", {
      ...options,
      run: () => ({ status: 0, stdout: "[GNUPG:] GOODSIG unexpected\n" }),
    }),
  ).toThrow("not made by the trusted release signing key");
  expect(() =>
    verifyGenerationSignature("manifest.asc", "manifest.json", {
      ...options,
      run: () => ({ status: 0 }),
    }),
  ).toThrow("not made by the trusted release signing key");
});
