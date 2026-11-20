import { expect, jest, test } from "@jest/globals";
import conductorRepository from "../../../src/conductor/runtime/repository.mjs";

function createRepository() {
  const runCommand = jest.fn(async () => ({ code: 0 }));
  const runCommandCapture = jest.fn(async () => ({ code: 0, stdout: "", stderr: "" }));
  const repository = conductorRepository({
    repositoryUrl: "https://nodejs.eliware.org",
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

test("composes release polling with repository JSON requests", async () => {
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
