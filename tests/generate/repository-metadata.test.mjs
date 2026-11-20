import { expect, jest, test } from "@jest/globals";

const spawnSync = jest.fn();
jest.unstable_mockModule("node:child_process", () => ({ spawnSync }));
const { default: createRepositoryMetadata } =
  await import("../../src/generate/repository-metadata.mjs");

test("runs createrepo with a SHA-256 checksum", () => {
  const run = jest.fn(() => ({ status: 0, stderr: "" }));
  expect(createRepositoryMetadata("/candidate/stable", run)).toEqual({ status: 0, stderr: "" });
  expect(run).toHaveBeenCalledWith("createrepo_c", ["--checksum", "sha256", "/candidate/stable"], {
    encoding: "utf8",
  });
});

test("throws command launch and metadata generation failures", () => {
  const failure = new Error("tool missing");
  expect(() => createRepositoryMetadata("/stable", () => ({ error: failure }))).toThrow(failure);
  expect(() =>
    createRepositoryMetadata("/stable", () => ({ status: 2, stderr: "bad metadata" })),
  ).toThrow("createrepo_c exited with status 2: bad metadata");
});

test("uses the default process runner", () => {
  spawnSync.mockReturnValue({ status: 0, stderr: "" });
  expect(createRepositoryMetadata("/stable")).toEqual({ status: 0, stderr: "" });
  expect(spawnSync).toHaveBeenCalledWith("createrepo_c", ["--checksum", "sha256", "/stable"], {
    encoding: "utf8",
  });
});
