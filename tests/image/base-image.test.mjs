import { expect, jest, test } from "@jest/globals";
import getBaseImageDigest from "../../src/image/base-image.mjs";

const baseImage = "quay.io/centos/centos:stream10";
const digest = `quay.io/centos/centos@sha256:${"d".repeat(64)}`;

function dependencies(inspect) {
  return {
    runCommand: jest.fn(),
    runCommandCapture: jest.fn(async () => ({
      stdout: JSON.stringify([{ RepoDigests: inspect }]),
    })),
  };
}

test("pulls and inspects the image to return its immutable digest", async () => {
  const calls = dependencies([digest]);
  await expect(getBaseImageDigest({ baseImage, ...calls })).resolves.toBe(digest);
  expect(calls.runCommand).toHaveBeenCalledWith("docker", ["pull", baseImage]);
  expect(calls.runCommandCapture).toHaveBeenCalledWith("docker", ["image", "inspect", baseImage], {
    quiet: true,
  });
});

test("rejects inspection results without a CentOS image digest", async () => {
  for (const inspect of [[], ["other@sha256:abc"]])
    await expect(getBaseImageDigest({ baseImage, ...dependencies(inspect) })).rejects.toThrow(
      "immutable digest",
    );
});
