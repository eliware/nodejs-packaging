import discoverLatestNpm from "../../src/discover/npm.mjs";
function response(metadata, ok = true, status = 200) {
  return { ok, status, json: async () => metadata };
}

test("returns verified npm archive metadata", async () => {
  const metadata = {
    version: "12.2.3",
    dist: {
      tarball: "https://registry.npmjs.org/npm/-/npm-12.2.3.tgz",
      integrity: "sha512-abc123==",
    },
  };
  const result = await discoverLatestNpm("latest", async () => response(metadata));

  expect(result).toEqual({
    version: "12.2.3",
    file: "npm-12.2.3.tgz",
    url: metadata.dist.tarball,
    integrity: metadata.dist.integrity,
  });
});

test("rejects npm archives from untrusted hosts", async () => {
  await expect(
    discoverLatestNpm("latest", async () =>
      response({
        version: "12.2.3",
        dist: {
          tarball: "https://example.test/npm.tgz",
          integrity: "sha512-abc123==",
        },
      }),
    ),
  ).rejects.toThrow("npm registry returned an untrusted archive URL");
});

test("rejects registry errors, unexpected versions, and invalid npm versions", async () => {
  await expect(discoverLatestNpm("latest", async () => response({}, false, 503))).rejects.toThrow(
    "npm registry returned HTTP 503",
  );
  await expect(
    discoverLatestNpm("12.2.3", async () => response({ version: "12.2.4" })),
  ).rejects.toThrow("npm registry returned 12.2.4 for requested version 12.2.3");
  for (const version of ["11.9.0", "12.0", "next"]) {
    await expect(
      discoverLatestNpm("latest", async () => response({ version, dist: {} })),
    ).rejects.toThrow(`latest npm version must be 12.0.0 or later, received ${version}`);
  }
});

test("requires a trusted HTTPS tarball URL and SHA-512 integrity", async () => {
  await expect(
    discoverLatestNpm("latest", async () =>
      response({
        version: "12.2.3",
        dist: { tarball: "http://registry.npmjs.org/npm.tgz", integrity: "sha512-abc==" },
      }),
    ),
  ).rejects.toThrow("npm registry returned an untrusted archive URL");
  await expect(
    discoverLatestNpm("latest", async () =>
      response({ version: "12.2.3", dist: { tarball: "https://registry.npmjs.org/npm.tgz" } }),
    ),
  ).rejects.toThrow("npm registry did not provide a SHA-512 integrity value");
  await expect(
    discoverLatestNpm("latest", async () =>
      response({ version: "12.2.3", dist: { integrity: "sha512-abc==" } }),
    ),
  ).rejects.toThrow();
});

test("uses the global fetch implementation and rejects missing version metadata", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    response({
      version: "12.2.3",
      dist: { tarball: "https://registry.npmjs.org/npm.tgz", integrity: "sha512-abc==" },
    });
  try {
    await expect(discoverLatestNpm()).resolves.toMatchObject({ version: "12.2.3" });
    await expect(
      discoverLatestNpm("latest", async () =>
        response({
          dist: { tarball: "https://registry.npmjs.org/npm.tgz", integrity: "sha512-abc==" },
        }),
      ),
    ).rejects.toThrow("latest npm version must be 12.0.0 or later, received none");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
