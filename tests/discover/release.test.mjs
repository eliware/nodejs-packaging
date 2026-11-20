import discoverLatestRelease from "../../src/discover/release.mjs";

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

test("finds a requested stable release and rejects an unavailable version", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => [
      { version: "v26.13.1", files: ["linux-x64"], date: "2026-01-01" },
      { version: "v26.12.0", files: ["linux-x64"], date: "2025-12-01" },
    ],
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    await expect(discoverLatestRelease(fetchImpl, "26.12.0")).resolves.toMatchObject({
      node_version: "26.12.0",
    });
    await expect(
      discoverLatestRelease(
        async () => ({
          ok: true,
          json: async () => [{ version: "v26.12.0", files: ["linux-x64"] }],
        }),
        "26.11.0",
      ),
    ).rejects.toThrow("Node.js release index has no stable Node.js 26.11.0 x64 release");
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("uses global fetch when no implementation is supplied", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => [{ version: "v26.13.1", files: ["linux-x64"], date: "2026-01-01" }],
  });
  try {
    await expect(discoverLatestRelease()).resolves.toMatchObject({ node_version: "26.13.1" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
