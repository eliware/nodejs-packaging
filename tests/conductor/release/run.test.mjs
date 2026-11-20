import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: runRelease } = await import("../../../src/conductor/release/run.mjs");

async function createOptions(plan) {
  const root = await fs.mkdtemp("/tmp/nodejs-release-run-");
  const nodeVersion = "26.13.1";
  const imagePath = path.join(root, "artifacts/images", nodeVersion, "image.json");
  const repositoryRoot = path.join(root, "repository");
  await fs.mkdir(path.dirname(imagePath), { recursive: true });
  await fs.mkdir(path.join(repositoryRoot, "metadata"), { recursive: true });
  await fs.writeFile(
    imagePath,
    JSON.stringify({
      repository: "ghcr.io/eliware/centos10-node26",
      tag: nodeVersion,
      digest: "sha256:image",
      published: true,
      local_image_id: "sha256:local",
      rpm_sha256: "rpm-sha256",
      base_image_digest: "base-sha256",
    }),
  );
  await fs.writeFile(
    path.join(repositoryRoot, "metadata/active-generation.json"),
    JSON.stringify({ generation: "generation-1" }),
  );
  const calls = [];
  const options = {
    plan,
    nodeVersion,
    release: { node_version: nodeVersion },
    npmRelease: { version: "12.2.3" },
    currentBaseDigest: "base-sha256",
    repositoryRoot,
    root,
    runId: "run-1",
    runNode: jest.fn(async (...args) => calls.push(args)),
    runNodeCapture: jest.fn(async (...args) => {
      calls.push(args);
      return { stdout: JSON.stringify({ output: "/candidate" }) };
    }),
    waitForPublishedRelease: jest.fn(async () => {}),
    saveState: jest.fn(async () => {}),
    checkpoint: jest.fn(async () => {}),
    generateReleaseReport: jest.fn(async () => ({ cardUrl: "https://example.test/card.png" })),
    notifyConductor: jest.fn(async () => {}),
    setStage: jest.fn(),
    calls,
  };
  return { options, root, calls };
}

test("publishes RPM and image releases and records final completion", async () => {
  const { options, root, calls } = await createOptions({
    buildRpm: true,
    reason: "nodejs-update",
  });
  try {
    await runRelease(options);
    expect(calls.map(([script]) => script)).toEqual([
      "bin/prepare-release.mjs",
      "bin/build-rpm.mjs",
      "bin/generate-repository.mjs",
      "bin/publish-release.mjs",
      "bin/build-image.mjs",
      "bin/publish-image-record.mjs",
      "bin/commit-publish-repository.mjs",
    ]);
    const imageRecordCall = calls.find(([script]) => script === "bin/publish-image-record.mjs");
    expect(imageRecordCall[2]).toEqual({ NODEJS_REPOSITORY_ROOT: options.repositoryRoot });
    expect(options.waitForPublishedRelease).toHaveBeenCalledWith("26.13.1", "12.2.3");
    expect(options.checkpoint).toHaveBeenCalledTimes(2);
    expect(options.generateReleaseReport).toHaveBeenCalledWith(
      expect.objectContaining({ nodeVersion: "26.13.1", npmVersion: "12.2.3" }),
    );
    expect(options.notifyConductor).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Node.js conductor run completed",
        cardUrl: expect.any(String),
      }),
    );
    expect(options.saveState).toHaveBeenCalledWith(expect.objectContaining({ stage: "complete" }));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("keeps a published release successful when its final state write fails", async () => {
  const { options, root } = await createOptions({ buildRpm: false, reason: "base-image-update" });
  options.saveState.mockRejectedValue(new Error("state storage unavailable"));
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    await expect(runRelease(options)).resolves.toBeUndefined();
    expect(options.notifyConductor).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Node.js conductor run completed" }),
    );
    expect(error).toHaveBeenCalledWith(
      "[conductor] release completed but final state could not be saved: state storage unavailable",
    );
  } finally {
    error.mockRestore();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("reuses the published RPM when the base image changes", async () => {
  const { options, root, calls } = await createOptions({
    buildRpm: false,
    reason: "base-image-update",
  });
  try {
    await runRelease(options);
    expect(calls.map(([script]) => script)).toEqual([
      "bin/build-image.mjs",
      "bin/publish-image-record.mjs",
      "bin/commit-publish-repository.mjs",
    ]);
    expect(options.waitForPublishedRelease).not.toHaveBeenCalled();
    expect(options.checkpoint).toHaveBeenCalledTimes(1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("rejects an image record without a successful publication", async () => {
  const { options, root } = await createOptions({ buildRpm: false, reason: "base-image-update" });
  try {
    await fs.writeFile(
      path.join(root, "artifacts/images/26.13.1/image.json"),
      JSON.stringify({ digest: null, published: false }),
    );
    await expect(runRelease(options)).rejects.toThrow(
      "did not record a successful GHCR publication",
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("rejects an image built from a different base digest", async () => {
  const { options, root } = await createOptions({ buildRpm: false, reason: "base-image-update" });
  try {
    const imagePath = path.join(root, "artifacts/images/26.13.1/image.json");
    const image = JSON.parse(await fs.readFile(imagePath, "utf8"));
    image.base_image_digest = "sha256:stale-base";
    await fs.writeFile(imagePath, JSON.stringify(image));
    await expect(runRelease(options)).rejects.toThrow(
      "image base digest does not match the current release plan",
    );
    expect(options.runNode).not.toHaveBeenCalledWith("bin/publish-image-record.mjs", [imagePath]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
