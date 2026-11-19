import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => ({
  ...fs,
  copyFile: (source, destination) => fs.cp(source, destination),
}));
const { default: reportPublishModule } = await import("../../src/report/publish.mjs");
const { publishReport } = reportPublishModule();

test("writes the report and updates the latest card and report records", async () => {
  const repositoryRoot = "/virtual/report-publish";
  const reportPath = path.join(repositoryRoot, "metadata/runs/run-1/release-report.json");
  const imagePath = path.join(repositoryRoot, "metadata/runs/run-1/release-card.png");
  await fs.mkdir(path.dirname(imagePath), { recursive: true });
  await fs.writeFile(imagePath, "card image");
  const report = {
    run_id: "run-1",
    card: {
      png: "https://nodejs.example/metadata/runs/run-1/release-card.png",
      latest: "https://nodejs.example/metadata/latest-release-card.png",
    },
  };
  await publishReport({ reportPath, imagePath, repositoryRoot, report });
  await expect(fs.readFile(reportPath, "utf8")).resolves.toContain('"run_id": "run-1"');
  await expect(
    fs.readFile(path.join(repositoryRoot, "metadata/latest-release-card.png"), "utf8"),
  ).resolves.toBe("card image");
  await expect(
    fs.readFile(path.join(repositoryRoot, "metadata/latest-release-report.json"), "utf8"),
  ).resolves.toContain("https://nodejs.example/metadata/runs/run-1/release-report.json");
});
test("creates the metadata path when no previous report exists", async () => {
  const repositoryRoot = "/virtual/report-publish-empty";
  const reportPath = path.join(repositoryRoot, "metadata/runs/run-2/release-report.json");
  const imagePath = path.join(repositoryRoot, "card.png");
  await fs.mkdir(path.dirname(imagePath), { recursive: true });
  await fs.writeFile(imagePath, "new card");
  await publishReport({
    reportPath,
    imagePath,
    repositoryRoot,
    report: {
      run_id: "run-2",
      card: { png: "https://nodejs.example/release-card.png", latest: "latest" },
    },
  });
  await expect(fs.readFile(reportPath, "utf8")).resolves.toContain('"run_id": "run-2"');
});
