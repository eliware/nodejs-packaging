import { expect, jest, test } from "@jest/globals";
import path from "node:path";

const discoverLatestRelease = jest.fn();
const discoverLatestNpm = jest.fn();
const prepareReleasePlan = jest.fn();
const hasDiscordWebhook = jest.fn();
const notifyConductor = jest.fn();
const generateReleaseReport = jest.fn();
const runRelease = jest.fn();
const conductorRuntime = jest.fn();
const commands = { run: jest.fn() };
jest.unstable_mockModule("../src/discover/release.mjs", () => ({
  default: () => ({ discoverLatestRelease }),
}));
jest.unstable_mockModule("../src/discover/npm.mjs", () => ({
  default: () => ({ discoverLatestNpm }),
}));
jest.unstable_mockModule("../src/conductor/release/plan.mjs", () => ({
  default: () => ({ prepareReleasePlan }),
}));
jest.unstable_mockModule("../src/discord-notifier.mjs", () => ({
  default: () => ({ hasDiscordWebhook, notifyConductor }),
}));
jest.unstable_mockModule("../src/release-report.mjs", () => ({
  default: () => ({ generateReleaseReport }),
}));
jest.unstable_mockModule("../src/conductor/release/run.mjs", () => ({
  default: () => ({ runRelease }),
}));
jest.unstable_mockModule("../src/conductor/runtime.mjs", () => ({
  default: () => ({ conductorRuntime }),
}));
jest.unstable_mockModule("../src/conductor/commands.mjs", () => ({ default: () => commands }));
const { default: conductorModule } = await import("../src/conductor.mjs");
const { main } = conductorModule();

function makeRuntime() {
  return {
    checkpoint: jest.fn(),
    acquireLock: jest.fn(async () => true),
    releaseLock: jest.fn(),
    saveState: jest.fn(),
    getJson: jest.fn(),
    getBaseImageDigest: jest.fn(),
    waitForPublishedRelease: jest.fn(),
    runNode: jest.fn(),
    runNodeCapture: jest.fn(),
  };
}

function plan(overrides = {}) {
  return {
    release: { node_version: "26.13.1" },
    npmRelease: { version: "12.2.3" },
    currentBaseDigest: "sha256:base",
    nodeVersion: "26.13.1",
    plan: { noOp: true, buildRpm: false, buildImage: false },
    ...overrides,
  };
}

function reset(runtime = makeRuntime()) {
  for (const mock of [
    discoverLatestRelease,
    discoverLatestNpm,
    prepareReleasePlan,
    hasDiscordWebhook,
    notifyConductor,
    generateReleaseReport,
    runRelease,
    conductorRuntime,
  ])
    mock.mockReset();
  process.exitCode = 0;
  conductorRuntime.mockReturnValue(runtime);
  hasDiscordWebhook.mockReturnValue(true);
  prepareReleasePlan.mockImplementation(async ({ setStage }) => {
    setStage("plan");
    return plan();
  });
  return runtime;
}

test("rejects unsupported conductor modes", async () => {
  reset();
  await expect(main(["--resume"], {})).rejects.toThrow(
    "choose exactly one conductor mode: --dry-run or --wet-run",
  );
});

test("reads a dry-run mode from process arguments", async () => {
  reset();
  const argv = process.argv;
  process.argv = [process.execPath, "conductor.mjs", "--dry-run"];
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  try {
    await main();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("dry-run passed"));
  } finally {
    process.argv = argv;
    log.mockRestore();
  }
});

test("runs the dry-run plan without requiring a Discord webhook", async () => {
  const runtime = reset();
  hasDiscordWebhook.mockReturnValue(false);
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  try {
    await main(["--dry-run"], {
      NODEJS_CONDUCTOR_STATE_ROOT: "/tmp/state/",
      NODEJS_REPOSITORY_ROOT: "/tmp/repository",
      NODEJS_REPOSITORY_URL: "https://repo.example.test/",
    });
    expect(conductorRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        stateRoot: path.resolve("/tmp/state"),
        repositoryUrl: "https://repo.example.test",
        baseImage: "quay.io/centos/centos:stream10",
        commands,
      }),
    );
    expect(runtime.acquireLock).toHaveBeenCalledWith(path.join(path.resolve("/tmp/state"), "lock"));
    expect(runtime.releaseLock).toHaveBeenCalledWith(path.join(path.resolve("/tmp/state"), "lock"));
    expect(discoverLatestRelease).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("dry-run passed; no build is needed"));
  } finally {
    log.mockRestore();
  }
});

test("uses defaults for a dry run that would build a release", async () => {
  const runtime = reset();
  prepareReleasePlan.mockImplementation(async ({ setStage }) => {
    setStage("discover");
    return plan({ plan: { noOp: false, buildRpm: true, buildImage: true } });
  });
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  try {
    await main(["--dry-run"], {});
    expect(conductorRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryUrl: "https://nodejs.eliware.org",
        stateRoot: path.resolve("/var/lib/eliware/nodejs-packaging/conductor"),
      }),
    );
    expect(runtime.releaseLock).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("would build RPM=true and image=true"),
    );
  } finally {
    log.mockRestore();
  }
});

test("reports no updates during a wet run", async () => {
  const runtime = reset();
  await main(["--wet-run"], { NODEJS_REPOSITORY_URL: "https://repo.example.test" });
  expect(hasDiscordWebhook).toHaveBeenCalled();
  expect(notifyConductor).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "No updates available",
      status: "success",
      fields: expect.arrayContaining([
        { name: "Node.js", value: "26.13.1" },
        { name: "npm", value: "12.2.3" },
      ]),
    }),
  );
  expect(runRelease).not.toHaveBeenCalled();
  expect(runtime.releaseLock).toHaveBeenCalled();
});

test("runs the release workflow when updates exist", async () => {
  const runtime = reset();
  const releasePlan = plan({ plan: { noOp: false, buildRpm: true, buildImage: false } });
  prepareReleasePlan.mockImplementation(async ({ setStage }) => {
    setStage("build-rpm");
    return releasePlan;
  });
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  runRelease.mockImplementation(async ({ setStage }) => setStage("complete"));
  try {
    await main(["--wet-run"], { NODEJS_REPOSITORY_URL: "https://repo.example.test" });
    expect(runRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: releasePlan.plan,
        nodeVersion: "26.13.1",
        release: releasePlan.release,
        npmRelease: releasePlan.npmRelease,
        currentBaseDigest: "sha256:base",
        repositoryRoot: path.resolve("/eliware/nodejs-repository"),
        root: expect.any(String),
        runNode: runtime.runNode,
        runNodeCapture: runtime.runNodeCapture,
        waitForPublishedRelease: runtime.waitForPublishedRelease,
        saveState: runtime.saveState,
        checkpoint: runtime.checkpoint,
        generateReleaseReport,
        notifyConductor,
      }),
    );
  } finally {
    log.mockRestore();
  }
});

test("reports preflight failures and releases an acquired lock", async () => {
  const runtime = reset();
  hasDiscordWebhook.mockReturnValue(false);
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    await main(["--wet-run"], {});
    expect(process.exitCode).toBe(1);
    expect(notifyConductor).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Node.js conductor preflight failed",
        fields: expect.arrayContaining([
          {
            name: "Error",
            value: "DISCORD_WEBHOOK is not configured in the conductor environment",
          },
        ]),
      }),
    );
    expect(runtime.releaseLock).toHaveBeenCalled();
  } finally {
    error.mockRestore();
  }
});

test("reports insecure repository URLs and lock acquisition errors", async () => {
  const runtime = reset();
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    await main(["--dry-run"], { NODEJS_REPOSITORY_URL: "http://repo.example.test" });
    expect(notifyConductor).not.toHaveBeenCalled();
    await main(["--wet-run"], { NODEJS_REPOSITORY_URL: "http://repo.example.test" });
    expect(notifyConductor).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Node.js conductor preflight failed",
        fields: expect.arrayContaining([
          { name: "Error", value: "NODEJS_REPOSITORY_URL must use HTTPS" },
        ]),
      }),
    );
    runtime.acquireLock.mockRejectedValueOnce(new Error("lock unavailable"));
    await main(["--wet-run"], {});
    expect(notifyConductor).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Node.js conductor preflight failed",
        fields: expect.arrayContaining([{ name: "Error", value: "lock unavailable" }]),
      }),
    );
    expect(runtime.releaseLock).toHaveBeenCalledTimes(2);
  } finally {
    errorLog.mockRestore();
    process.exitCode = 0;
  }
});
