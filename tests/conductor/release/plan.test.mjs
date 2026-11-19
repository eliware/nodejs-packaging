import { afterAll, expect, jest, test } from "@jest/globals";
import conductorReleasePlanModule from "../../../src/conductor/release/plan.mjs";

const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
afterAll(() => consoleLog.mockRestore());

const { prepareReleasePlan } = conductorReleasePlanModule();

function createOptions(catalog) {
  return {
    repositoryUrl: "https://nodejs.eliware.org",
    runId: "run-1",
    getJson: jest.fn(async (url) => (url.endsWith("/readyz") ? { status: "ready" } : catalog)),
    getBaseImageDigest: jest.fn(async () => "base-sha256"),
    saveState: jest.fn(async () => {}),
    setStage: jest.fn(),
    discoverNode: jest.fn(async () => ({ node_version: "26.13.1" })),
    discoverNpm: jest.fn(async () => ({ version: "12.2.3" })),
  };
}

const stableRelease = {
  node_version: "26.13.1",
  npm: { version: "12.2.3" },
  image: { base_image_digest: "base-sha256", digest: "image-sha256" },
};

test("plans the current stable release without a rebuild", async () => {
  const options = createOptions({
    metadata_version: "0.1.0",
    node_major: 26,
    stable: { latest: stableRelease },
    images: [{ node_version: "26.13.1", base_image_digest: "base-sha256", digest: "image-sha256" }],
  });
  const result = await prepareReleasePlan(options);
  expect(result.plan).toEqual(
    expect.objectContaining({
      noOp: true,
      reason: "no-updates",
      buildRpm: false,
      buildImage: false,
    }),
  );
  expect(result.nodeVersion).toBe("26.13.1");
  expect(options.setStage).toHaveBeenCalledWith("upstream-check");
  expect(options.saveState).toHaveBeenCalledWith(
    expect.objectContaining({ node_version: "26.13.1", npm_version: "12.2.3" }),
  );
});

test("uses release image metadata when the image catalog is absent", async () => {
  const options = createOptions({
    metadata_version: "0.1.0",
    node_major: 26,
    stable: { latest: stableRelease },
  });
  const result = await prepareReleasePlan(options);
  expect(result.plan.reason).toBe("no-updates");
});

test("rejects an unready service and incompatible catalog", async () => {
  const unready = createOptions({});
  unready.getJson.mockResolvedValueOnce({ status: "starting" });
  await expect(prepareReleasePlan(unready)).rejects.toThrow("repository service is not ready");
  const incompatible = createOptions({ metadata_version: "0.2.0", node_major: 26 });
  await expect(prepareReleasePlan(incompatible)).rejects.toThrow("does not match the Node.js 26");
});

test("rejects an empty stable catalog when no RPM version exists", async () => {
  const options = createOptions({ metadata_version: "0.1.0", node_major: 26 });
  options.discoverNode.mockResolvedValue({});
  options.discoverNpm.mockResolvedValue({ version: "12.2.3" });
  await expect(prepareReleasePlan(options)).rejects.toThrow("no Node.js RPM is published");
});
