import { expect, test } from "@jest/globals";
import fileOperations from "../../src/publish/files.mjs";

test("composes file copy, hash, and listing operations", () => {
  expect(Object.keys(fileOperations()).sort()).toEqual(["atomicCopy", "hashFile", "listFiles"]);
});
