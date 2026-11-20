import { expect, jest, test } from "@jest/globals";
import conductorDockerImage from "../../../src/conductor/runtime/docker-image.mjs";

function createImage() {
  const runCommand = jest.fn(async () => ({ code: 0 }));
  const runCommandCapture = jest.fn(async () => ({ code: 0, stdout: "", stderr: "" }));
  const image = conductorDockerImage({
    baseImage: "quay.io/centos/centos:stream10",
    runCommand,
    runCommandCapture,
  });
  return { image, runCommand, runCommandCapture };
}

test("pulls and reads an immutable base image digest", async () => {
  const { image, runCommand, runCommandCapture } = createImage();
  runCommandCapture.mockResolvedValueOnce({
    stdout: JSON.stringify([
      { RepoDigests: ["other@sha256:no", "quay.io/centos/centos@sha256:abc"] },
    ]),
  });
  await expect(image.getBaseImageDigest()).resolves.toBe("quay.io/centos/centos@sha256:abc");
  expect(runCommand).toHaveBeenCalledWith("docker", ["pull", "quay.io/centos/centos:stream10"]);
  expect(runCommandCapture).toHaveBeenCalledWith(
    "docker",
    ["image", "inspect", "quay.io/centos/centos:stream10"],
    { quiet: true },
  );
});

test("rejects an image without a CentOS immutable digest", async () => {
  const { image, runCommandCapture } = createImage();
  runCommandCapture.mockResolvedValue({
    stdout: JSON.stringify([{ RepoDigests: ["other@sha256:no"] }]),
  });
  await expect(image.getBaseImageDigest()).rejects.toThrow("immutable digest");
  runCommandCapture.mockResolvedValue({ stdout: JSON.stringify([{}]) });
  await expect(image.getBaseImageDigest()).rejects.toThrow("immutable digest");
});
