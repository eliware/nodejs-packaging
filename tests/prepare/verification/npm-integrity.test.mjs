import { expect, jest, test } from "@jest/globals";

const hashFile = jest.fn(async () => "npm-hash");
jest.unstable_mockModule("../../../src/prepare/hash.mjs", () => ({ default: hashFile }));
const { default: verifyNpmArchiveIntegrity } =
  await import("../../../src/prepare/verification/npm-integrity.mjs");

const input = {
  npmArchivePath: "/archive/npm.tgz",
  npmRelease: { file: "npm.tgz", integrity: "sha512-npm-hash" },
};

test("checks npm archive integrity", async () => {
  await expect(verifyNpmArchiveIntegrity(input)).resolves.toBeUndefined();
  expect(hashFile).toHaveBeenCalledWith("/archive/npm.tgz", "sha512", "base64");
});

test("rejects an npm archive integrity mismatch", async () => {
  hashFile.mockResolvedValueOnce("wrong");
  await expect(verifyNpmArchiveIntegrity(input)).rejects.toThrow(
    "npm archive integrity mismatch for npm.tgz",
  );
});
