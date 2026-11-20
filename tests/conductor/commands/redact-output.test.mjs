import { expect, test } from "@jest/globals";
import redactOutput from "../../../src/conductor/commands/redact-output.mjs";

test("redacts command output streams with the supplied environment", () => {
  const safe = redactOutput({
    stdout: "secret output",
    stderr: "secret error",
    env: { API_KEY: "secret output", WEBHOOK_TOKEN: "secret error" },
  });
  expect(safe.stdout).not.toContain("secret output");
  expect(safe.stderr).not.toContain("secret error");
});

test("uses empty streams and the process environment by default", () => {
  expect(redactOutput({})).toEqual({ stdout: "", stderr: "" });
});
