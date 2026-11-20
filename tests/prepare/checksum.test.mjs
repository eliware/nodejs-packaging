import { expect, test } from "@jest/globals";
import checksumForFile from "../../src/prepare/checksum.mjs";

test("selects a unique archive checksum", () => {
  const checksum = "a".repeat(64);
  expect(checksumForFile(`${checksum} *node.tar.xz\n`, "node.tar.xz")).toBe(checksum);
  expect(() => checksumForFile("", "node.tar.xz")).toThrow("no unique entry");
  expect(() =>
    checksumForFile(`${checksum} node.tar.xz\n${checksum} *node.tar.xz`, "node.tar.xz"),
  ).toThrow("no unique entry");
});
