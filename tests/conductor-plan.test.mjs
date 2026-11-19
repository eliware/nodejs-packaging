import test from "node:test";
import assert from "node:assert/strict";
import { planRelease } from "../scripts/conductor-plan.mjs";

const base = "quay.io/centos/centos@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

test("builds the RPM and image when Node.js has a newer stable release", () => {
  const plan = planRelease({
    latestNodeVersion: "26.14.0", publishedNodeVersion: "26.13.1",
    publishedBaseImageDigest: base, currentBaseImageDigest: base, publishedImageDigest: "sha256:image",
  });
  assert.equal(plan.buildRpm, true);
  assert.equal(plan.buildImage, true);
  assert.equal(plan.reason, "nodejs-update");
});

test("builds only the image when the CentOS base digest changes", () => {
  const plan = planRelease({
    latestNodeVersion: "26.13.1", publishedNodeVersion: "26.13.1",
    publishedBaseImageDigest: base, currentBaseImageDigest: `${base.slice(0, -1)}b`, publishedImageDigest: "sha256:image",
  });
  assert.equal(plan.buildRpm, false);
  assert.equal(plan.buildImage, true);
  assert.equal(plan.reason, "base-image-update");
});

test("does nothing when Node.js and the image base match the published release", () => {
  const plan = planRelease({
    latestNodeVersion: "26.13.1", publishedNodeVersion: "26.13.1",
    publishedBaseImageDigest: base, currentBaseImageDigest: base, publishedImageDigest: "sha256:image",
  });
  assert.equal(plan.buildRpm, false);
  assert.equal(plan.buildImage, false);
  assert.equal(plan.noOp, true);
});

test("creates an image baseline when no image record exists", () => {
  const plan = planRelease({
    latestNodeVersion: "26.13.1", publishedNodeVersion: "26.13.1",
    publishedBaseImageDigest: null, currentBaseImageDigest: base, publishedImageDigest: null,
  });
  assert.equal(plan.buildRpm, false);
  assert.equal(plan.buildImage, true);
  assert.equal(plan.reason, "image-baseline");
});
