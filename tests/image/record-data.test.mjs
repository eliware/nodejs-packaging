import { expect, test } from "@jest/globals";
import createImageRecordData from "../../src/image/record-data.mjs";

test("builds image record data and resolves its output directory", () => {
  const result = createImageRecordData({
    target: { image: "ghcr.io/eliware/node" },
    pushImage: true,
    version: "26.13.1",
    root: "/repository",
    args: new Map(),
    sourceInput: { source: { sha256: "source-hash" } },
    publishedRelease: { package: { sha256: "rpm-hash" }, generation_id: "generation-1" },
    baseImage: "quay.io/centos/centos:stream10",
    baseDigest: "quay.io/centos/centos@sha256:base",
    inspect: { Id: "local-id" },
    registryDigest: "sha256:registry",
  });
  expect(result).toMatchObject({
    resultDir: "/repository/artifacts/images/26.13.1",
    record: {
      repository: "ghcr.io/eliware/node",
      digest: "sha256:registry",
      published: true,
      local_image_id: "local-id",
      source_sha256: "source-hash",
      rpm_sha256: "rpm-hash",
    },
  });
});

test("uses an explicit output directory for local images", () => {
  const result = createImageRecordData({
    target: { image: "ghcr.io/eliware/node" },
    pushImage: false,
    version: "26.13.1",
    root: "/repository",
    args: new Map([["output", "/tmp/images"]]),
    sourceInput: { source: { sha256: "source-hash" } },
    publishedRelease: { package: { sha256: "rpm-hash" }, generation_id: "generation-1" },
    baseImage: "centos:stream10",
    baseDigest: "sha256:base",
    inspect: { Id: "local-id" },
    registryDigest: null,
  });
  expect(result.resultDir).toBe("/tmp/images");
  expect(result.record).toEqual(expect.objectContaining({ digest: null, published: false }));
});
