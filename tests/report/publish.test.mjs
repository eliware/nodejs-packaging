import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => ({
  ...fs,
  copyFile: (source, destination) => fs.cp(source, destination),
}));
const { default: publishReport } = await import("../../src/report/publish.mjs");

test("creates and persists a report record for the rendered card", async () => {
  const repositoryRoot = "/virtual/report-publish";
  const imagePath = path.join(repositoryRoot, "metadata/runs/run-1/release-card.png");
  await fs.mkdir(path.dirname(imagePath), { recursive: true });
  await fs.writeFile(imagePath, "card image");
  const result = await publishReport({
    runId: "run-1",
    repositoryRoot,
    imagePath,
    nodeVersion: "26.13.1",
    npmVersion: "12.2.3",
    baseDigest: "sha256:base",
    imageDigest: "sha256:image",
    imageId: "sha256:id",
    rpmSha256: "a".repeat(64),
    reason: "Node.js update",
    changed: true,
    imageSha256: "card-sha256",
    baseUrl: "https://nodejs.example",
    now: new Date("2026-11-19T12:00:00.000Z"),
  });
  expect(result).toMatchObject({
    cardUrl: "https://nodejs.example/metadata/runs/run-1/release-card.png",
    reportPath: path.join(repositoryRoot, "metadata/runs/run-1/release-report.json"),
    report: expect.objectContaining({
      run_id: "run-1",
      status: "certified",
      image_digest: "sha256:image",
      card: expect.objectContaining({ sha256: "card-sha256" }),
    }),
  });
  await expect(fs.readFile(result.reportPath, "utf8")).resolves.toContain('"run_id": "run-1"');
});
