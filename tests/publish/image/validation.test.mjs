import { expect, test } from "@jest/globals";
import validateImageRecord from "../../../src/publish/image/validation.mjs";

function validImage() {
  return {
    validation: "passed",
    published: true,
    repository: "ghcr.io/eliware/centos10-node26",
    tag: "26.13.1",
    source_release: "26.13.1",
    digest: `sha256:${"a".repeat(64)}`,
    base_image: "quay.io/centos/centos:stream10",
    base_image_digest: `quay.io/centos/centos@sha256:${"b".repeat(64)}`,
    rpm_sha256: "c".repeat(64),
    source_sha256: "d".repeat(64),
    local_image_id: `sha256:${"e".repeat(64)}`,
    repository_generation: "node-v26.13.1-el10-x86_64-1",
  };
}

test("accepts a passed image record with a registry digest", () => {
  const image = validImage();
  expect(validateImageRecord(image)).toBe(image);
});

test("rejects failed validation and malformed registry digests", () => {
  const invalidRecords = [
    { validation: "failed" },
    { published: false },
    { repository: "" },
    { repository: null },
    { tag: "latest" },
    { source_release: "26.13.0" },
    { digest: "sha256:bad" },
    { base_image: "" },
    { base_image_digest: "" },
    { rpm_sha256: "bad" },
    { rpm_sha256: undefined },
    { source_sha256: "bad" },
    { source_sha256: undefined },
    { local_image_id: "" },
    { repository_generation: "" },
  ];
  for (const update of invalidRecords)
    expect(() => validateImageRecord({ ...validImage(), ...update })).toThrow(
      "image record must contain a passed validation and registry digest",
    );
  expect(() => validateImageRecord(null)).toThrow(
    "image record must contain a passed validation and registry digest",
  );
  expect(() => validateImageRecord({ validation: "passed" })).toThrow(
    "image record must contain a passed validation and registry digest",
  );
});
