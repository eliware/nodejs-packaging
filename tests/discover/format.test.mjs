import { expect, test } from "@jest/globals";
import formatDiscoveredRelease from "../../src/discover/format.mjs";

test("formats release data as indented JSON with a final newline", () => {
  const output = formatDiscoveredRelease({ node_version: "26.13.1" });
  expect(output).toBe('{\n  "node_version": "26.13.1"\n}\n');
});
