import sourceModule from "../../src/discover/release.mjs";
const { discoverLatestRelease, main } = sourceModule();

test("selects the newest stable Node.js 26 x64 release", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => [
      { version: "v27.0.0", files: ["linux-x64"], date: "2026-01-03" },
      { version: "v26.13.0", files: ["linux-x64"], date: "2026-01-02" },
      { version: "v26.13.1", files: ["linux-x64"], date: "2026-01-01" },
      { version: "v26.13.1", files: ["linux-x64"], date: "2026-01-01" },
      { version: "malformed", files: ["linux-x64"] },
      { version: "v26.12.0" },
      { version: "v26.14.0", files: ["linux-arm64"], date: "2026-01-04" },
    ],
  });

  const release = await discoverLatestRelease(fetchImpl);

  expect(release.node_version).toBe("26.13.1");
  expect(release.source.file).toBe("node-v26.13.1-linux-x64.tar.xz");
});

test("rejects a malformed Node.js release index", async () => {
  await expect(
    discoverLatestRelease(async () => ({ ok: true, json: async () => ({}) })),
  ).rejects.toThrow("Node.js release index must contain an array");
});

test("rejects registry errors and indexes without a stable Node.js 26 x64 archive", async () => {
  await expect(discoverLatestRelease(async () => ({ ok: false, status: 502 }))).rejects.toThrow(
    "Node.js release index returned HTTP 502",
  );
  for (const releases of [
    [{ version: "v27.0.0", files: ["linux-x64"] }],
    [{ version: "v26.13.1", files: ["linux-arm64"] }],
    [{ version: "v26.13.1-rc1", files: ["linux-x64"] }],
  ]) {
    await expect(
      discoverLatestRelease(async () => ({ ok: true, json: async () => releases })),
    ).rejects.toThrow("Node.js release index has no stable Node.js 26 x64 release");
  }
});

test("exposes the command entry point with an injected fetch implementation", async () => {
  const result = await main(async () => ({
    ok: true,
    json: async () => [{ version: "v26.13.1", files: ["linux-x64"], date: "2026-01-01" }],
  }));
  expect(result.node_version).toBe("26.13.1");
});

test("uses the global fetch implementation for its default command entry point", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => [{ version: "v26.13.1", files: ["linux-x64"], date: "2026-01-01" }],
  });
  try {
    const result = await main();
    expect(result.node_version).toBe("26.13.1");
    await expect(discoverLatestRelease()).resolves.toMatchObject({ node_version: "26.13.1" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
