import path from "node:path";
import { expect, test } from "@jest/globals";
import resolveRollbackInput from "../../../src/publish/rollback/input.mjs";

test("resolves rollback options and repository root", () => {
  expect(
    resolveRollbackInput(["--generation", "generation-1"], {
      NODEJS_REPOSITORY_ROOT: "/virtual/repository",
    }),
  ).toEqual({ generation: "generation-1", root: path.resolve("/virtual/repository") });
  expect(resolveRollbackInput([], {})).toEqual({
    generation: undefined,
    root: path.resolve("/eliware/nodejs-repository"),
  });
});
