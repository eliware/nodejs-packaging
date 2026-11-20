import { expect, test } from "@jest/globals";
import publishFilesystem from "../../src/publish/filesystem.mjs";

test("provides the focused publication filesystem operations", () => {
  expect(Object.keys(publishFilesystem()).sort()).toEqual([
    "atomicCopy",
    "exists",
    "hashFile",
    "listFiles",
    "replacePointer",
    "writeJson",
  ]);
});
