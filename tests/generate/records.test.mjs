import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: writeReleaseRecords } = await import("../../src/generate/records.mjs");

test("writes release, validation, provenance, catalog, and generation records", async () => {
  const root = "/virtual/records";
  const candidate = path.join(root, "candidate");
  const templateRoot = path.join(root, "templates");
  const generated = new Date("2026-11-19T12:00:00.000Z");
  const sourceInput = {
    source: { url: "https://nodejs.org/archive", sha256: "b".repeat(64) },
    npm: { version: "12.2.3", integrity: "sha512-test" },
  };
  const rpmRecordUpdated = {
    name: "eliware-node26",
    version: "26.13.1",
    npm_version: "12.2.3",
    path: "el10/x86_64/stable/node.rpm",
    sha256: "c".repeat(64),
    size: 123,
  };
  await fs.mkdir(templateRoot, { recursive: true });
  await fs.writeFile(
    path.join(templateRoot, "catalog.seed.json"),
    JSON.stringify({ metadata_version: "0.1.0", node_major: 26, stable: { items: [] } }),
  );
  await writeReleaseRecords({
    candidate,
    root,
    version: "26.13.1",
    generationId: "node-v26.13.1-el10-x86_64-test",
    rpmRecordUpdated,
    sourceInput,
    now: generated,
  });

  const release = JSON.parse(
    await fs.readFile(path.join(candidate, "metadata/releases/nodejs26.json")),
  );
  expect(release).toEqual(
    expect.objectContaining({
      channel: "stable",
      node_version: "26.13.1",
      generation_id: "node-v26.13.1-el10-x86_64-test",
      package: rpmRecordUpdated,
      source: sourceInput.source,
      npm: sourceInput.npm,
    }),
  );
  const validation = JSON.parse(
    await fs.readFile(path.join(candidate, "metadata/validation/package.json")),
  );
  expect(validation.checks).toEqual(
    expect.objectContaining({ archive_signature: "passed", npm_version: "12.2.3" }),
  );
  const provenance = JSON.parse(
    await fs.readFile(path.join(candidate, "metadata/provenance/package.json")),
  );
  expect(provenance).toEqual(expect.objectContaining({ package: rpmRecordUpdated }));
  const catalog = JSON.parse(await fs.readFile(path.join(candidate, "metadata/catalog.json")));
  expect(catalog.active_generation).toBe("node-v26.13.1-el10-x86_64-test");
  expect(catalog.stable.latest).toEqual(release);
  const generation = JSON.parse(await fs.readFile(path.join(candidate, "generation.json")));
  expect(generation.generated).toBe(generated.toISOString());
});
