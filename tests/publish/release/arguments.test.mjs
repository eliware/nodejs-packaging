import { expect, test } from "@jest/globals";
import parseReleaseArguments from "../../../src/publish/release/arguments.mjs";

test("parses publication options into a map", () => {
  const args = parseReleaseArguments([
    "--version",
    "26.13.1",
    "--candidate",
    "/virtual/candidate",
    "--repository",
    "/virtual/repo",
  ]);
  expect(args.get("version")).toBe("26.13.1");
  expect(args.get("candidate")).toBe("/virtual/candidate");
  expect(args.get("repository")).toBe("/virtual/repo");
});
