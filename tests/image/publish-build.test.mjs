import { expect, jest, test } from "@jest/globals";

const runDocker = jest.fn();
const publishImage = jest.fn();
jest.unstable_mockModule("../../src/image/docker.mjs", () => ({ default: runDocker }));
jest.unstable_mockModule("../../src/image/publish.mjs", () => ({ default: publishImage }));
const { default: publishBuiltImage } = await import("../../src/image/publish-build.mjs");

const digest = `sha256:${"a".repeat(64)}`;

test("pushes version and latest tags and returns the shared digest", async () => {
  publishImage.mockResolvedValue(digest);
  await expect(publishBuiltImage("node:26.13.1", "ghcr.io/eliware/centos10-node26")).resolves.toBe(
    digest,
  );
  expect(runDocker).toHaveBeenCalledWith(
    ["tag", "node:26.13.1", "ghcr.io/eliware/centos10-node26:latest"],
    { stdio: "inherit" },
  );
  expect(publishImage.mock.calls).toEqual([
    ["node:26.13.1"],
    ["ghcr.io/eliware/centos10-node26:latest"],
  ]);
});

test("rejects a latest tag with a different digest", async () => {
  publishImage.mockReset().mockResolvedValueOnce(digest).mockResolvedValueOnce("other-digest");
  await expect(
    publishBuiltImage("node:26.13.1", "ghcr.io/eliware/centos10-node26"),
  ).rejects.toThrow(`latest image digest other-digest does not match ${digest}`);
});
