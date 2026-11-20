import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import resolveSourceDirectory from "../../src/prepare/source-path.mjs";

test("keeps the default and ignored state paths inside the repository", () => {
  const root = "/virtual/packaging";
  expect(resolveSourceDirectory(root)).toBe(path.join(root, ".state/sources"));
  expect(resolveSourceDirectory(root, path.join(root, ".state"))).toBe(path.join(root, ".state"));
  expect(resolveSourceDirectory(root, path.join(root, ".state/cache"))).toBe(
    path.join(root, ".state/cache"),
  );
});

test("allows source caches outside the repository", () => {
  const root = "/virtual/packaging";
  expect(resolveSourceDirectory(root, "/var/cache/nodejs")).toBe("/var/cache/nodejs");
  expect(resolveSourceDirectory(root, "/")).toBe("/");
  expect(resolveSourceDirectory(root, path.dirname(root))).toBe(path.dirname(root));
});

test("rejects source caches in tracked repository paths", () => {
  const root = "/virtual/packaging";
  for (const directory of [root, path.join(root, "build-config/cache")])
    expect(() => resolveSourceDirectory(root, directory)).toThrow(
      "NODEJS_SOURCE_DIR must be outside the repository or under ignored .state",
    );
});

test("rejects tracked source paths before a download can start", () => {
  const root = "/virtual/packaging";
  const download = jest.fn();
  expect(() => {
    resolveSourceDirectory(root, path.join(root, "build-config/release-cache"));
    download();
  }).toThrow("NODEJS_SOURCE_DIR must be outside the repository or under ignored .state");
  expect(download).not.toHaveBeenCalled();
});
