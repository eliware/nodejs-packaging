import { expect, jest, test } from "@jest/globals";
import runtimeRepositoryModule from "../../../src/conductor/runtime/repository.mjs";

const { conductorRepository } = runtimeRepositoryModule();

function createRepository() {
  const runCommand = jest.fn(async () => ({ code: 0 }));
  const runCommandCapture = jest.fn(async () => ({ code: 0, stdout: "", stderr: "" }));
  const repository = conductorRepository({
    repositoryUrl: "https://nodejs.eliware.org",
    baseImage: "quay.io/centos/centos:stream10",
    runCommand,
    runCommandCapture,
  });
  return { repository, runCommand, runCommandCapture };
}

test("loads JSON and reports HTTP errors", async () => {
  const { repository } = createRepository();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ ready: true }) }));
    await expect(repository.getJson("https://example.test/readyz")).resolves.toEqual({
      ready: true,
    });
    globalThis.fetch = jest.fn(async () => ({ ok: false, status: 503 }));
    await expect(repository.getJson("https://example.test/readyz")).rejects.toThrow(
      "/readyz returned HTTP 503",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("pulls and inspects the configured base image digest", async () => {
  const { repository, runCommand, runCommandCapture } = createRepository();
  runCommandCapture
    .mockResolvedValueOnce({
      stdout: JSON.stringify([
        { RepoDigests: ["other@sha256:no", "quay.io/centos/centos@sha256:abc"] },
      ]),
    })
    .mockResolvedValueOnce({ stdout: JSON.stringify([{ RepoDigests: ["other@sha256:no"] }]) })
    .mockResolvedValueOnce({ stdout: JSON.stringify([{}]) });
  await expect(repository.getBaseImageDigest()).resolves.toBe("quay.io/centos/centos@sha256:abc");
  await expect(repository.getBaseImageDigest()).rejects.toThrow("immutable digest");
  await expect(repository.getBaseImageDigest()).rejects.toThrow("immutable digest");
  expect(runCommand).toHaveBeenCalledWith("docker", ["pull", "quay.io/centos/centos:stream10"]);
});

test("waits for the published Node.js and npm versions", async () => {
  const { repository } = createRepository();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        stable: { latest: { node_version: "26.13.1", npm: { version: "12.2.3" } } },
      }),
    }));
    await expect(repository.waitForPublishedRelease("26.13.1", "12.2.3")).resolves.toBeUndefined();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("retries mismatched and failed catalog responses until timeout", async () => {
  const { repository } = createRepository();
  const originalFetch = globalThis.fetch;
  jest.useFakeTimers();
  try {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ stable: { latest: { node_version: "26.13.0" } } }),
    }));
    const mismatch = repository.waitForPublishedRelease("26.13.1", "12.2.3");
    const mismatchError = expect(mismatch).rejects.toThrow("after 60 seconds");
    await jest.advanceTimersByTimeAsync(60_000);
    await mismatchError;
    globalThis.fetch = jest.fn(async () => ({ ok: false, status: 503 }));
    const failed = repository.waitForPublishedRelease("26.13.1", "12.2.3");
    const failedError = expect(failed).rejects.toThrow("after 60 seconds");
    await jest.advanceTimersByTimeAsync(60_000);
    await failedError;
    expect(globalThis.fetch).toHaveBeenCalledTimes(30);
  } finally {
    jest.useRealTimers();
    globalThis.fetch = originalFetch;
  }
});
