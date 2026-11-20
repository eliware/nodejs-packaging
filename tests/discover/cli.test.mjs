import { expect, test } from "@jest/globals";
import discoverReleaseCommand from "../../src/discover/cli.mjs";

test("formats the discovered release for the command launcher", async () => {
  const output = await discoverReleaseCommand(async () => ({
    ok: true,
    json: async () => [{ version: "v26.13.1", files: ["linux-x64"], date: "2026-01-01" }],
  }));
  expect(JSON.parse(output)).toMatchObject({ node_version: "26.13.1" });
  expect(output.endsWith("\n")).toBe(true);
});

test("uses global fetch when the launcher supplies no implementation", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => [{ version: "v26.13.1", files: ["linux-x64"], date: "2026-01-01" }],
  });
  try {
    await expect(discoverReleaseCommand()).resolves.toContain('"node_version": "26.13.1"');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
