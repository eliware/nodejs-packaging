import planRelease from "../../src/conductor/plan.mjs";

const base =
  "quay.io/centos/centos@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function plan(overrides = {}) {
  return planRelease({
    latestNodeVersion: "26.13.1",
    publishedNodeVersion: "26.13.1",
    latestNpmVersion: "12.2.3",
    publishedNpmVersion: "12.2.3",
    publishedBaseImageDigest: base,
    currentBaseImageDigest: base,
    publishedImageDigest: "sha256:image",
    ...overrides,
  });
}

test("builds the RPM and image when Node.js has a newer release", () => {
  const result = plan({ latestNodeVersion: "26.14.0" });
  expect(result.nodeUpdate).toBe(true);
  expect(result.npmUpdate).toBe(false);
  expect(result.buildRpm).toBe(true);
  expect(result.buildImage).toBe(true);
  expect(result.reason).toBe("nodejs-update");
});

test("builds the RPM and image when npm has a newer release", () => {
  const result = plan({ latestNpmVersion: "12.2.4" });
  expect(result.nodeUpdate).toBe(false);
  expect(result.npmUpdate).toBe(true);
  expect(result.buildRpm).toBe(true);
  expect(result.buildImage).toBe(true);
  expect(result.reason).toBe("npm-update");
});

test("builds the RPM and image when Node.js and npm both update", () => {
  const result = plan({ latestNodeVersion: "26.14.0", latestNpmVersion: "12.3.0" });
  expect(result.buildRpm).toBe(true);
  expect(result.buildImage).toBe(true);
  expect(result.reason).toBe("nodejs-and-npm-update");
});

test("builds only the image when the CentOS base digest changes", () => {
  const result = plan({ currentBaseImageDigest: `${base.slice(0, -1)}b` });
  expect(result.buildRpm).toBe(false);
  expect(result.buildImage).toBe(true);
  expect(result.baseImageUpdate).toBe(true);
  expect(result.reason).toBe("base-image-update");
});

test("does nothing when Node.js, npm, and the base image match", () => {
  const result = plan();
  expect(result.buildRpm).toBe(false);
  expect(result.buildImage).toBe(false);
  expect(result.noOp).toBe(true);
  expect(result.reason).toBe("no-updates");
});

test("does nothing when no image record exists and upstream versions match", () => {
  const result = plan({
    publishedBaseImageDigest: null,
    publishedImageDigest: null,
  });
  expect(result.buildRpm).toBe(false);
  expect(result.buildImage).toBe(true);
  expect(result.baseImageUpdate).toBe(true);
  expect(result.noOp).toBe(false);
  expect(result.reason).toBe("base-image-update");
});

test("builds the RPM when the published release has no npm version", () => {
  const result = plan({ publishedNpmVersion: null });
  expect(result.npmUpdate).toBe(true);
  expect(result.buildRpm).toBe(true);
  expect(result.buildImage).toBe(true);
  expect(result.reason).toBe("npm-update");
});

test("rejects unsupported latest Node.js versions", () => {
  expect(() => plan({ latestNodeVersion: "27.0.0" })).toThrow(
    "Node.js versions must use the 26.x.y format",
  );
});

test("rejects a malformed published Node.js version", () => {
  expect(() => plan({ publishedNodeVersion: "latest" })).toThrow(
    "Node.js versions must use the 26.x.y format",
  );
});

test("rejects npm versions older than version 12", () => {
  expect(() => plan({ latestNpmVersion: "11.9.0" })).toThrow(
    "npm versions must use the 12.0.0 or later format",
  );
});

test("rejects a missing latest npm version", () => {
  expect(() => plan({ latestNpmVersion: undefined })).toThrow(
    "npm versions must use the 12.0.0 or later format",
  );
});

test("rejects a malformed published npm version", () => {
  expect(() => plan({ publishedNpmVersion: "latest" })).toThrow(
    "npm versions must use the 12.0.0 or later format",
  );
});
