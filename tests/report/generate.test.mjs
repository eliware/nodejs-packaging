import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const renderCard = jest.fn(async () => "card-sha256");
const publishReport = jest.fn(async () => {});
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("../../src/report/render-card.mjs", () => ({
  default: () => ({ renderCard }),
}));
jest.unstable_mockModule("../../src/report/publish.mjs", () => ({
  default: () => ({ publishReport }),
}));
const { default: reportGenerateModule } = await import("../../src/report/generate.mjs");
const { generateReleaseReport } = reportGenerateModule();

test("assembles report metadata and delegates card and report publication", async () => {
  const root = process.cwd();
  await fs.mkdir(path.join(root, "assets"), { recursive: true });
  await fs.writeFile(path.join(root, "assets/eliware-brand.svg"), "logo");
  process.env.NODEJS_REPOSITORY_URL = "https://reports.example.test";
  try {
    const result = await generateReleaseReport({
      runId: "run-1",
      repositoryRoot: "/virtual/report-generation",
      nodeVersion: "26.13.1",
      npmVersion: "12.2.3",
      baseDigest: "sha256:base",
      imageDigest: "sha256:image",
      imageId: "sha256:id",
      rpmSha256: "a".repeat(64),
      reason: "Node.js update",
      changed: true,
    });
    expect(result).toEqual(
      expect.objectContaining({
        cardUrl: "https://reports.example.test/metadata/runs/run-1/release-card.png",
        imageSha256: "card-sha256",
      }),
    );
    expect(renderCard).toHaveBeenCalledWith(
      "/virtual/report-generation/metadata/runs/run-1/release-card.html",
      "/virtual/report-generation/metadata/runs/run-1/release-card.png",
    );
    expect(publishReport).toHaveBeenCalledWith(
      expect.objectContaining({
        reportPath: "/virtual/report-generation/metadata/runs/run-1/release-report.json",
        report: expect.objectContaining({
          status: "certified",
          image_digest: "sha256:image",
          card: expect.objectContaining({ sha256: "card-sha256" }),
        }),
      }),
    );
  } finally {
    delete process.env.NODEJS_REPOSITORY_URL;
  }
});
