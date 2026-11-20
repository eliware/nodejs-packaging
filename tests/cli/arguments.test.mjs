import { expect, test } from "@jest/globals";
import parseArguments from "../../src/cli/arguments.mjs";

test("parses options, skips positional values, and keeps the last repeated value", () => {
  const args = parseArguments(["positional", "--version", "26.13.1", "--version", "26.13.2"]);
  expect(args.get("version")).toBe("26.13.2");
  expect(args.size).toBe(1);
});

test("consumes values that begin with dashes", () => {
  expect(parseArguments(["--generation", "--unexpected"]).get("generation")).toBe("--unexpected");
});

test("parses configured boolean options without consuming a value", () => {
  const args = parseArguments(["--push", "--tag", "latest"], ["push"]);
  expect(args.get("push")).toBe(true);
  expect(args.get("tag")).toBe("latest");
});
