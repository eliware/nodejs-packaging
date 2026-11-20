import { expect, jest, test } from "@jest/globals";
import path from "node:path";
import inspectPublishedImage from "../../src/image/inspection.mjs";

test("inspects the built image and assembles its publication record", () => {
  const runDocker = jest.fn(() => ({ stdout: JSON.stringify([{ Id: "sha256:local" }]) }));
  const result = inspectPublishedImage({
    image: "ghcr.io/eliware/node:26.13.1",
    target: { image: "ghcr.io/eliware/node" },
    pushImage: true,
    version: "26.13.1",
    root: "/virtual/repository",
    args: new Map(),
    sourceInput: { source: { sha256: "source-hash" } },
    publishedRelease: { package: { sha256: "rpm-hash" }, generation_id: "generation-1" },
    baseImage: "quay.io/centos/centos:stream10",
    baseDigest: "quay.io/centos/centos@sha256:base",
    runDocker,
    registryDigest: "sha256:registry",
  });
  expect(runDocker).toHaveBeenCalledWith(["image", "inspect", "ghcr.io/eliware/node:26.13.1"], {
    encoding: "utf8",
  });
  expect(result).toMatchObject({
    resultDir: path.join(path.resolve("/virtual/repository"), "artifacts/images/26.13.1"),
    record: {
      local_image_id: "sha256:local",
      digest: "sha256:registry",
      source_sha256: "source-hash",
      rpm_sha256: "rpm-hash",
    },
  });
});
