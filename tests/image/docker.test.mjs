import { expect, jest, test } from "@jest/globals";

const spawnSync = jest.fn();
jest.unstable_mockModule("node:child_process", () => ({ spawnSync }));
const { default: runDocker } = await import("../../src/image/docker.mjs");

test("runs Docker with the supplied options and returns its result", () => {
  const result = { status: 0, stdout: "image data" };
  spawnSync.mockReturnValueOnce(result);
  expect(runDocker(["image", "inspect", "node:26"], { encoding: "utf8" })).toBe(result);
  expect(spawnSync).toHaveBeenCalledWith("docker", ["image", "inspect", "node:26"], {
    encoding: "utf8",
  });
});

test("throws Docker launch and command failures", () => {
  const failure = new Error("docker missing");
  spawnSync.mockReturnValueOnce({ error: failure });
  expect(() => runDocker(["pull", "node:26"])).toThrow(failure);
  spawnSync.mockReturnValueOnce({ status: 2 });
  expect(() => runDocker(["build"])).toThrow("docker build exited with status 2");
});

test("returns nonzero results when the caller handles command validation", () => {
  const result = { status: 1, stderr: "runtime mismatch" };
  spawnSync.mockReturnValueOnce(result);
  expect(runDocker(["run", "node:26"], { encoding: "utf8" }, false)).toBe(result);
});
