import { expect, test } from "@jest/globals";
import validateDownloadUrl from "../../../src/prepare/download/validate-url.mjs";

test("accepts HTTPS URLs from trusted hosts", () => {
  expect(validateDownloadUrl("https://nodejs.org/file", ["nodejs.org"]).hostname).toBe(
    "nodejs.org",
  );
});

test("rejects insecure and untrusted URLs", () => {
  expect(() => validateDownloadUrl("http://nodejs.org/file", ["nodejs.org"])).toThrow(
    "trusted HTTPS hosts",
  );
  expect(() => validateDownloadUrl("https://example.org/file", ["nodejs.org"])).toThrow(
    "trusted HTTPS hosts",
  );
});
