import { expect, test } from "@jest/globals";
import parseRollbackArguments from "../../../src/publish/rollback/arguments.mjs";

test("consumes a following option-looking value", () => {
  const args = parseRollbackArguments(["--generation", "--unknown"]);
  expect(args.get("generation")).toBe("--unknown");
  expect(args.has("unknown")).toBe(false);
  expect(args.has("force")).toBe(false);
});
