import { expect, test } from "@jest/globals";
import redactCommandOutput from "../../../src/conductor/commands/redact.mjs";

test("redacts secret environment values and ignores short or unrelated values", () => {
  const output = redactCommandOutput("secret token-value short ordinary number", {
    API_KEY: "secret",
    ACCESS_TOKEN: "token-value",
    SHORT_PASSWORD: "short",
    NORMAL: "ordinary",
    NUMBER_KEY: 42,
  });
  expect(output).not.toContain("secret");
  expect(output).not.toContain("token-value");
  expect(output).toContain("short");
  expect(output).toContain("ordinary");
  expect(output).toContain("number");
});

test("uses the current environment when no environment is supplied", () => {
  expect(redactCommandOutput("plain output")).toBe("plain output");
});
