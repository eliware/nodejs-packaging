import { expect, jest, test } from "@jest/globals";
import path from "node:path";

const publishBuiltImage = jest.fn(async () => "sha256:digest");
const writeImageRecord = jest.fn(async () => {});
jest.unstable_mockModule("../../src/image/publish-build.mjs", () => ({
  default: publishBuiltImage,
}));
jest.unstable_mockModule("../../src/image/record.mjs", () => ({ default: writeImageRecord }));
const { default: publishImage } = await import("../../src/image/publication.mjs");

function input(overrides = {}) {
  return {
    image: "ghcr.io/eliware/node:26.13.1",
    target: { image: "ghcr.io/eliware/node" },
    pushImage: true,
    version: "26.13.1",
    root: "/repository",
    args: new Map(),
    sourceInput: { source: { sha256: "source-hash" } },
    publishedRelease: {
      package: { sha256: "rpm-hash" },
      generation_id: "generation-1",
    },
    baseImage: "quay.io/centos/centos:stream10",
    baseDigest: "quay.io/centos/centos@sha256:base",
    runDocker: jest.fn(() => ({ stdout: JSON.stringify([{ Id: "local-id" }]) })),
    ...overrides,
  };
}

test("publishes an image and writes its publication record", async () => {
  publishBuiltImage.mockClear();
  writeImageRecord.mockClear();
  const value = input();
  await publishImage(value);
  expect(publishBuiltImage).toHaveBeenCalledWith(value.image, value.target.image);
  expect(writeImageRecord).toHaveBeenCalledWith(
    path.join(path.resolve("/repository"), "artifacts/images/26.13.1"),
    expect.objectContaining({
      digest: "sha256:digest",
      published: true,
      local_image_id: "local-id",
      source_sha256: "source-hash",
      rpm_sha256: "rpm-hash",
    }),
  );
});

test("records a local image without publishing it and honors the output path", async () => {
  publishBuiltImage.mockClear();
  const output = path.resolve("/tmp/images");
  const value = input({ pushImage: false, args: new Map([["output", output]]) });
  await publishImage(value);
  expect(publishBuiltImage).not.toHaveBeenCalled();
  expect(writeImageRecord).toHaveBeenLastCalledWith(
    output,
    expect.objectContaining({ digest: null, published: false }),
  );
});
