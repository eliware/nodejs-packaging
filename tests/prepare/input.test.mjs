import { expect, test } from "@jest/globals";
import loadPrepareInput from "../../src/prepare/input.mjs";

const selected = { node_version: "26.13.1" };

test("resolves selected release and npm version inputs", () => {
  expect(loadPrepareInput([], selected)).toEqual({
    version: "26.13.1",
    allowOlder: false,
    npmVersion: "latest",
  });
  expect(
    loadPrepareInput(
      ["--version", "26.13.0", "--allow-older", "true", "--npm-version", "12.2.3"],
      selected,
    ),
  ).toMatchObject({ version: "26.13.0", allowOlder: true, npmVersion: "12.2.3" });
});

test("rejects unsupported and non-latest releases without the override", () => {
  expect(() => loadPrepareInput(["--version", "27.0.0"], selected)).toThrow(
    "unsupported Node.js 26 version: 27.0.0",
  );
  expect(() => loadPrepareInput(["--version", "26.13.0"], selected)).toThrow(
    "is not the latest stable Node.js 26 release 26.13.1",
  );
});
