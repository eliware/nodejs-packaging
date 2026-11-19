import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: conductorRuntimeModule } = await import("../../src/conductor/runtime.mjs");
const { conductorRuntime } = conductorRuntimeModule();

function createRuntime() {
  const root = path.join(process.cwd(), "test-fixtures");
  const stateRoot = "/virtual/state";
  const commands = {
    runCommand: jest.fn(async () => ({ code: 0 })),
    runCommandCapture: jest.fn(async () => ({ code: 0, stdout: "", stderr: "" })),
  };
  const runtime = conductorRuntime({
    root,
    stateRoot,
    repositoryUrl: "https://nodejs.eliware.org",
    baseImage: "quay.io/centos/centos:stream10",
    runId: "run-1",
    notifyConductor: jest.fn(async () => {}),
    commands,
  });
  return { runtime, stateRoot, commands };
}

test("creates and removes the conductor lock and saves state atomically", async () => {
  const { runtime, stateRoot } = createRuntime();
  await runtime.acquireLock(path.join(stateRoot, "lock"));
  const owner = JSON.parse(await fs.readFile(path.join(stateRoot, "lock/owner.json"), "utf8"));
  expect(owner).toEqual(expect.objectContaining({ run_id: "run-1", pid: process.pid }));
  await runtime.saveState({ stage: "complete" });
  const saved = JSON.parse(await fs.readFile(path.join(stateRoot, "last-run.json"), "utf8"));
  expect(saved).toEqual(
    expect.objectContaining({ stage: "complete", updated: expect.any(String) }),
  );
  await runtime.releaseLock(path.join(stateRoot, "lock"));
  await expect(fs.stat(path.join(stateRoot, "lock"))).rejects.toMatchObject({ code: "ENOENT" });
});

test("notifies checkpoint observers", async () => {
  const { runtime } = createRuntime();
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  try {
    await runtime.checkpoint("Passed", "Done", [{ name: "Stage", value: "test" }]);
    expect(log).toHaveBeenCalledWith("[conductor] checkpoint passed: Passed");
  } finally {
    log.mockRestore();
  }
});

test("loads JSON and reports HTTP errors", async () => {
  const { runtime } = createRuntime();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ status: "ready" }) }));
    await expect(runtime.getJson("https://example.test/readyz")).resolves.toEqual({
      status: "ready",
    });
    globalThis.fetch = jest.fn(async () => ({ ok: false, status: 503 }));
    await expect(runtime.getJson("https://example.test/readyz")).rejects.toThrow(
      "/readyz returned HTTP 503",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("discovers the base image digest and rejects missing digest data", async () => {
  const { runtime, commands } = createRuntime();
  commands.runCommandCapture
    .mockResolvedValueOnce({
      stdout: JSON.stringify([{ RepoDigests: ["quay.io/centos/centos@sha256:abc"] }]),
    })
    .mockResolvedValueOnce({ stdout: JSON.stringify([{}]) });
  await expect(runtime.getBaseImageDigest()).resolves.toBe("quay.io/centos/centos@sha256:abc");
  await expect(runtime.getBaseImageDigest()).rejects.toThrow("immutable digest");
  expect(commands.runCommand).toHaveBeenCalledWith("docker", [
    "pull",
    "quay.io/centos/centos:stream10",
  ]);
});

test("waits for a matching release catalog", async () => {
  const { runtime } = createRuntime();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        stable: { latest: { node_version: "26.13.1", npm: { version: "12.2.3" } } },
      }),
    }));
    await expect(runtime.waitForPublishedRelease("26.13.1", "12.2.3")).resolves.toBeUndefined();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("continues polling when the stable catalog does not match the release", async () => {
  const { runtime } = createRuntime();
  const originalFetch = globalThis.fetch;
  jest.useFakeTimers();
  try {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        stable: { latest: { node_version: "26.13.0", npm: { version: "12.2.3" } } },
      }),
    }));
    const pending = runtime.waitForPublishedRelease("26.13.1", "12.2.3");
    const rejected = expect(pending).rejects.toThrow("after 60 seconds");
    await jest.advanceTimersByTimeAsync(60_000);
    await rejected;
    expect(globalThis.fetch).toHaveBeenCalledTimes(30);
  } finally {
    jest.useRealTimers();
    globalThis.fetch = originalFetch;
  }
});

test("retries a failed catalog lookup and stops after the retry limit", async () => {
  const { runtime } = createRuntime();
  const originalFetch = globalThis.fetch;
  jest.useFakeTimers();
  try {
    globalThis.fetch = jest.fn(async () => ({ ok: false, status: 503 }));
    const pending = runtime.waitForPublishedRelease("26.13.1", "12.2.3");
    const rejected = expect(pending).rejects.toThrow("after 60 seconds");
    await jest.advanceTimersByTimeAsync(60_000);
    await rejected;
    expect(globalThis.fetch).toHaveBeenCalledTimes(30);
  } finally {
    jest.useRealTimers();
    globalThis.fetch = originalFetch;
  }
});

test("runs Node.js commands with default and explicit arguments", async () => {
  const { runtime, commands } = createRuntime();
  await runtime.runNode("bin/example.mjs");
  await runtime.runNode("bin/example.mjs", ["--version"], { EXTRA: "yes" });
  commands.runCommandCapture.mockResolvedValue({ code: 0, stdout: "output", stderr: "" });
  await expect(runtime.runNodeCapture("bin/example.mjs")).resolves.toEqual({
    code: 0,
    stdout: "output",
    stderr: "",
  });
  await runtime.runNodeCapture("bin/example.mjs", ["--version"]);
});
