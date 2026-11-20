import { expect, jest, test } from "@jest/globals";

const verifySignature = jest.fn(async () => "A".repeat(40));
jest.unstable_mockModule("../../../src/prepare/signature.mjs", () => ({
  default: verifySignature,
}));
const { default: verifyNodeSignature } =
  await import("../../../src/prepare/verification/signature.mjs");

const input = {
  keyConfig: { fingerprints: ["A".repeat(40)] },
  keyringDir: "/keys",
  signaturePath: "/checksums.sig",
  checksumsPath: "/checksums.txt",
};

test("approves a trusted Node.js checksum signature", async () => {
  await expect(verifyNodeSignature(input)).resolves.toBe("A".repeat(40));
  expect(verifySignature).toHaveBeenCalledWith("/keys", "/checksums.sig", "/checksums.txt");
});

test("rejects an unapproved signing key", async () => {
  await expect(verifyNodeSignature({ ...input, keyConfig: { fingerprints: [] } })).rejects.toThrow(
    "unapproved key",
  );
});
