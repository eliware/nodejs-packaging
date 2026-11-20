import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: createReportCard } = await import("../../src/report/card.mjs");

test("writes and renders a release card for the report run", async () => {
  const root = process.cwd();
  const repositoryRoot = path.resolve("/virtual/report-card");
  await fs.mkdir(path.join(root, "assets"), { recursive: true });
  await fs.writeFile(path.join(root, "assets/eliware-brand.svg"), "<svg>logo</svg>");
  const renderImage = jest.fn(async () => "card-sha256");
  const result = await createReportCard({
    runId: "run-card",
    repositoryRoot,
    status: "✓ RELEASE COMPLETE",
    statusColor: "#55d68a",
    details: [["Node.js", "v26.13.1"]],
    reason: "release update",
    changed: true,
    renderImage,
  });
  expect(result).toEqual({
    htmlPath: path.join(repositoryRoot, "metadata/runs/run-card/release-card.html"),
    imagePath: path.join(repositoryRoot, "metadata/runs/run-card/release-card.png"),
    imageSha256: "card-sha256",
  });
  await expect(fs.readFile(result.htmlPath, "utf8")).resolves.toContain("RELEASE COMPLETE");
  expect(renderImage).toHaveBeenCalledWith(result.htmlPath, result.imagePath);
});
