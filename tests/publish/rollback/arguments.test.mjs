import { expect, test } from "@jest/globals";
import parseRollbackArguments from "../../../src/publish/rollback/arguments.mjs";

test("uses the last value for a repeated option", () => {
  const args = parseRollbackArguments(["--generation", "older", "--generation", "newer"]);
  expect(args.get("generation")).toBe("newer");
  expect(args.size).toBe(1);
});
