import { expect, jest, test } from "@jest/globals";

const spawnSync = jest.fn();
jest.unstable_mockModule("node:child_process", () => ({ spawnSync }));
const { default: verifySignature } = await import("../../src/prepare/signature.mjs");

const fingerprint = "A".repeat(40);

function validSignature() {
  return {
    status: 0,
    stdout: `[GNUPG:] VALIDSIG ${fingerprint} 2026-01-01 1 0 4 0 1 10 ${"B".repeat(40)}\n`,
    stderr: "",
  };
}

test("extracts the primary signing key fingerprint", () => {
  const run = jest.fn(validSignature);
  expect(verifySignature("/keys", "/sig", "/sums", run)).toBe("B".repeat(40));
  expect(run).toHaveBeenCalledWith(
    "gpg",
    expect.any(Array),
    expect.objectContaining({ timeout: 30_000 }),
  );
});

test("uses GnuPG by default and reports failures", () => {
  spawnSync.mockReturnValueOnce(validSignature());
  expect(verifySignature("/keys", "/sig", "/sums")).toBe("B".repeat(40));
  expect(spawnSync).toHaveBeenCalledWith("gpg", expect.any(Array), expect.any(Object));
  expect(() =>
    verifySignature("/keys", "/sig", "/sums", () => ({
      status: 2,
      stdout: "",
      stderr: "bad signature",
    })),
  ).toThrow("signature verification failed: bad signature");
  expect(() =>
    verifySignature("/keys", "/sig", "/sums", () => ({ status: 0, stdout: "GOODSIG", stderr: "" })),
  ).toThrow("GnuPG did not report a valid");
  const error = new Error("gpg unavailable");
  expect(() => verifySignature("/keys", "/sig", "/sums", () => ({ error }))).toThrow(error);
});
