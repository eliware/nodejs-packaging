import { expect, jest, test } from "@jest/globals";
import buildCatalogModule from "../../src/repository/catalog.mjs";

const { loadPublishedRelease } = buildCatalogModule();
const release = {
  node_version: "26.13.1",
  package: { name: "eliware-node26", sha256: "a".repeat(64) },
};
const catalog = {
  metadata_version: "0.1.0",
  node_major: 26,
  target: { architecture: "x86_64" },
  stable: { latest: release },
};

test("loads the matching stable RPM from the production catalog", async () => {
  const fetchImpl = jest.fn(async () => ({ ok: true, json: async () => catalog }));
  await expect(
    loadPublishedRelease("26.13.1", "https://nodejs.eliware.org", fetchImpl),
  ).resolves.toEqual({ repositoryBase: "https://nodejs.eliware.org", publishedRelease: release });
  expect(fetchImpl).toHaveBeenCalledWith(
    "https://nodejs.eliware.org/metadata/catalog.json",
    expect.objectContaining({ signal: expect.any(Object) }),
  );
});

test("requires a production HTTPS service root without credentials", async () => {
  await expect(loadPublishedRelease("26.13.1", "", jest.fn())).rejects.toThrow(
    "set NODEJS_REPOSITORY_URL",
  );
  await expect(loadPublishedRelease("26.13.1", "http://example.test", jest.fn())).rejects.toThrow(
    "must use HTTPS",
  );
  await expect(
    loadPublishedRelease("26.13.1", "https://user:pass@example.test", jest.fn()),
  ).rejects.toThrow("must use HTTPS");
  for (const url of [
    "https://example.test/catalog",
    "https://example.test/?x=1",
    "https://example.test/#top",
  ])
    await expect(loadPublishedRelease("26.13.1", url, jest.fn())).rejects.toThrow(
      "must name the production service root",
    );
});

test("rejects failed responses and incompatible release catalogs", async () => {
  await expect(
    loadPublishedRelease("26.13.1", "https://example.test", async () => ({
      ok: false,
      status: 503,
    })),
  ).rejects.toThrow("returned HTTP 503");
  for (const invalidCatalog of [
    { ...catalog, metadata_version: "2" },
    { ...catalog, node_major: 25 },
    { ...catalog, target: { architecture: "aarch64" } },
  ])
    await expect(
      loadPublishedRelease("26.13.1", "https://example.test", async () => ({
        ok: true,
        json: async () => invalidCatalog,
      })),
    ).rejects.toThrow("does not match the Node.js 26 x86_64 release contract");
});

test("rejects a different package version, package name, or missing checksum", async () => {
  for (const invalidRelease of [
    { ...release, node_version: "26.12.0" },
    { ...release, package: { ...release.package, name: "nodejs26" } },
    { ...release, package: { name: "eliware-node26", sha256: "bad" } },
    { ...release, package: { name: "eliware-node26", sha256: "" } },
  ])
    await expect(
      loadPublishedRelease("26.13.1", "https://example.test", async () => ({
        ok: true,
        json: async () => ({ ...catalog, stable: { latest: invalidRelease } }),
      })),
    ).rejects.toThrow();
});
