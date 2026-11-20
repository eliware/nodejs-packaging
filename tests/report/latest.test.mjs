import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => ({
  ...fs,
  copyFile: (source, destination) => fs.cp(source, destination),
}));
const { default: updateLatestReport } = await import("../../src/report/latest.mjs");

test("updates the latest card and report pointers", async () => {
  const repositoryRoot = "/virtual/report-latest";
  const imagePath = path.join(repositoryRoot, "runs/run-1/card.png");
  await fs.mkdir(path.dirname(imagePath), { recursive: true });
  await fs.writeFile(imagePath, "card image");
  const report = {
    run_id: "run-1",
    card: {
      png: "https://nodejs.example/metadata/runs/run-1/release-card.png",
      latest: "https://nodejs.example/metadata/latest-release-card.png",
    },
  };
  await updateLatestReport({ imagePath, repositoryRoot, report });
  await expect(
    fs.readFile(path.join(repositoryRoot, "metadata/latest-release-card.png"), "utf8"),
  ).resolves.toBe("card image");
  await expect(
    fs.readFile(path.join(repositoryRoot, "metadata/latest-release-report.json"), "utf8"),
  ).resolves.toContain("https://nodejs.example/metadata/runs/run-1/release-report.json");
});
