import { expect, test } from "@jest/globals";
import createImageRecord from "../../../src/publish/image/record-data.mjs";

const image = {
  repository: "ghcr.io/eliware/node",
  tag: "26.13.1",
  digest: "sha256:image",
  base_image: "quay.io/centos/centos:stream10",
  base_image_digest: "sha256:base",
  rpm_sha256: "sha256:rpm",
  source_release: "26.13.1",
};

test("builds the publication record without optional run logs", () => {
  const oldRunId = process.env.NODEJS_CONDUCTOR_RUN_ID;
  delete process.env.NODEJS_CONDUCTOR_RUN_ID;
  try {
    expect(createImageRecord(image)).toEqual({
      repository: image.repository,
      tag: image.tag,
      digest: image.digest,
      base_image: image.base_image,
      base_image_digest: image.base_image_digest,
      rpm_sha256: image.rpm_sha256,
      validation: "passed",
      provenance_path: "metadata/provenance/images/nodejs26-26.13.1.json",
    });
  } finally {
    if (oldRunId !== undefined) process.env.NODEJS_CONDUCTOR_RUN_ID = oldRunId;
  }
});

test("adds run log metadata when a conductor run exists", () => {
  const oldRunId = process.env.NODEJS_CONDUCTOR_RUN_ID;
  process.env.NODEJS_CONDUCTOR_RUN_ID = "run-1";
  try {
    expect(createImageRecord(image).logs_path).toBe("metadata/logs/run-1/");
  } finally {
    if (oldRunId === undefined) delete process.env.NODEJS_CONDUCTOR_RUN_ID;
    else process.env.NODEJS_CONDUCTOR_RUN_ID = oldRunId;
  }
});
