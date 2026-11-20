import { expect, test } from "@jest/globals";
import path from "node:path";
import { pathToFileURL } from "node:url";
import resolveServicePaths from "../../../src/conductor/service/paths.mjs";

test("resolves the project root and conductor executable", () => {
  expect(
    resolveServicePaths(
      pathToFileURL(
        path.resolve("/workspace/nodejs-packaging/src/conductor/service/entrypoint.mjs"),
      ),
    ),
  ).toEqual({
    root: path.resolve("/workspace/nodejs-packaging"),
    conductor: path.join(path.resolve("/workspace/nodejs-packaging"), "bin/conductor.mjs"),
  });
});
