import { expect, jest, test } from "@jest/globals";
import verifyGenerationSignature from "../../../src/publish/rollback/verify-signature.mjs";

test("verifies the signed generation manifest", () => {
  const verify = jest.fn(() => ({ status: 0 }));
  verifyGenerationSignature("manifest.asc", "manifest.json", verify);
  expect(verify).toHaveBeenCalledWith("gpg", ["--verify", "manifest.asc", "manifest.json"], {
    encoding: "utf8",
  });
});

test("reports signature verification failures", () => {
  expect(() =>
    verifyGenerationSignature("manifest.asc", "manifest.json", () => ({
      error: new Error("spawn failed"),
    })),
  ).toThrow("spawn failed");
  expect(() =>
    verifyGenerationSignature("manifest.asc", "manifest.json", () => ({ status: 1 })),
  ).toThrow("unknown error");
  expect(() =>
    verifyGenerationSignature("manifest.asc", "manifest.json", () => ({
      status: 1,
      stderr: "bad signature",
    })),
  ).toThrow("bad signature");
});
