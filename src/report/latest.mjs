import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export default async function updateLatestReport({ imagePath, repositoryRoot, report }) {
  const metadataRoot = path.join(repositoryRoot, "metadata");
  await mkdir(metadataRoot, { recursive: true });
  await copyFile(imagePath, path.join(metadataRoot, "latest-release-card.png"));
  await writeFile(
    path.join(metadataRoot, "latest-release-report.json"),
    `${JSON.stringify(
      {
        metadata_version: "0.1.0",
        schema: 1,
        run_id: report.run_id,
        report: report.card.png.replace(/release-card\.png$/, "release-report.json"),
        card: report.card.latest,
      },
      null,
      2,
    )}\n`,
  );
}
