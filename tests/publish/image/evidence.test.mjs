import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const sign = jest.fn(async () => {});
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("../../../src/publish/sign.mjs", () => ({ default: sign }));
const { default: writeImageEvidence } = await import("../../../src/publish/image/evidence.mjs");

test("writes image validation and signed provenance evidence", async () => {
  const stage = "/virtual/image-evidence";
  const packageProvenancePath = path.join(stage, "metadata/provenance/package.json");
  await fs.mkdir(path.dirname(packageProvenancePath), { recursive: true });
  await fs.mkdir(path.join(stage, "metadata/validation"), { recursive: true });
  await fs.writeFile(packageProvenancePath, JSON.stringify({ package: "nodejs26" }));
  await fs.writeFile(`${packageProvenancePath}.asc`, "old signature");
  const files = {
    writeJson: async (file, value) => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
    },
  };
  const image = {
    repository: "ghcr.io/eliware/centos10-node26",
    tag: "26.13.1",
    digest: `sha256:${"a".repeat(64)}`,
    base_image: "quay.io/centos/centos:stream10",
    base_image_digest: `quay.io/centos/centos@sha256:${"b".repeat(64)}`,
    source_release: "26.13.1",
    source_sha256: "c".repeat(64),
    local_image_id: "sha256:local",
  };
  const imageRecord = {
    ...image,
    validation: "passed",
    provenance_path: "metadata/provenance/images/nodejs26-26.13.1.json",
  };
  await writeImageEvidence({
    stage,
    image,
    imageRecord,
    generationId: "generation-1",
    generated: "2026-11-19T12:00:00.000Z",
    keyFingerprint: "F".repeat(40),
    gpgHome: "/keys",
    files,
  });
  expect(JSON.parse(await fs.readFile(packageProvenancePath, "utf8"))).toEqual(
    expect.objectContaining({ generation_id: "generation-1" }),
  );
  await expect(fs.stat(`${packageProvenancePath}.asc`)).rejects.toMatchObject({ code: "ENOENT" });
  expect(
    JSON.parse(await fs.readFile(path.join(stage, "metadata/validation/image.json"), "utf8")),
  ).toEqual(
    expect.objectContaining({ smoke_test: "passed", registry_push: "passed", status: "passed" }),
  );
  expect(sign).toHaveBeenCalledTimes(2);
});
