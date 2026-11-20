import { expect, test } from "@jest/globals";
import parseImageArguments from "../../src/image/arguments.mjs";

test("parses image build options and ignores positional arguments", () => {
  const args = parseImageArguments([
    "ignored",
    "--version",
    "26.13.1",
    "--push",
    "--base-digest",
    "sha256:base",
    "--output",
    "/tmp/image",
  ]);
  expect(args.get("version")).toBe("26.13.1");
  expect(args.has("push")).toBe(true);
  expect(args.get("base-digest")).toBe("sha256:base");
  expect(args.get("output")).toBe("/tmp/image");
});
