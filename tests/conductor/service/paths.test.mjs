import { expect, test } from "@jest/globals";
import resolveServicePaths from "../../../src/conductor/service/paths.mjs";

test("resolves the project root and conductor executable", () => {
  expect(
    resolveServicePaths("file:///workspace/nodejs-packaging/src/conductor/service/entrypoint.mjs"),
  ).toEqual({
    root: "/workspace/nodejs-packaging",
    conductor: "/workspace/nodejs-packaging/bin/conductor.mjs",
  });
});
