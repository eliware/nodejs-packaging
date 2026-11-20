import { expect, test } from "@jest/globals";
import parseRpmPackageInfo from "../../src/rpm/package-info.mjs";

test("parses and validates RPM metadata", () => {
  expect(
    parseRpmPackageInfo("eliware-node26\n(none)\n26.13.1\n1.npm12.2.3.el10\nx86_64\n", "26.13.1"),
  ).toEqual({
    name: "eliware-node26",
    epoch: null,
    version: "26.13.1",
    release: "1.npm12.2.3.el10",
    architecture: "x86_64",
  });
  expect(parseRpmPackageInfo("eliware-node26\n1\n26.13.1\n2\nx86_64\n", "26.13.1").epoch).toBe(1);
});

test("rejects RPM name, version, and architecture mismatches", () => {
  for (const output of [
    "other\n(none)\n26.13.1\n1\nx86_64",
    "eliware-node26\n(none)\n25.0.0\n1\nx86_64",
    "eliware-node26\n(none)\n26.13.1\n1\naarch64",
  ])
    expect(() => parseRpmPackageInfo(output, "26.13.1")).toThrow(
      "built RPM metadata does not match target",
    );
});
