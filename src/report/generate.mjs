import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import renderReleaseCardHtml from "./html.mjs";
import renderCard from "./render-card.mjs";
import publishReportRecord from "./publish.mjs";
import updateLatestReport from "./latest.mjs";
import reportRecordModule from "./record.mjs";
import createReportDetails from "./details.mjs";

const { createReportRecord } = reportRecordModule();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default async function generateReleaseReport({
  runId,
  repositoryRoot,
  nodeVersion,
  npmVersion,
  baseDigest,
  imageDigest,
  imageId,
  rpmSha256,
  reason,
  changed,
}) {
  const directory = path.join(repositoryRoot, "metadata/runs", runId);
  await mkdir(directory, { recursive: true });
  const logo = await readFile(path.join(root, "assets/eliware-brand.svg"));
  const logoData = `data:image/svg+xml;base64,${logo.toString("base64")}`;
  const status = changed ? "✓ RELEASE COMPLETE" : "✓ NO UPDATES";
  const details = createReportDetails({
    nodeVersion,
    npmVersion,
    baseDigest,
    imageDigest,
    rpmSha256,
    reason,
  });
  const html = renderReleaseCardHtml({
    logoData,
    status,
    statusColor: changed ? "#55d68a" : "#8fb7dc",
    details,
    runId,
    reason,
    changed,
  });
  const htmlPath = path.join(directory, "release-card.html");
  const imagePath = path.join(directory, "release-card.png");
  await writeFile(htmlPath, html);
  const imageSha256 = await renderCard(htmlPath, imagePath);
  const baseUrl = process.env.NODEJS_REPOSITORY_URL || "https://nodejs.eliware.org";
  const { cardUrl, report } = createReportRecord({
    runId,
    nodeVersion,
    npmVersion,
    baseDigest,
    imageDigest,
    imageId,
    rpmSha256,
    reason,
    changed,
    baseUrl,
    imageSha256,
  });
  const reportPath = path.join(directory, "release-report.json");
  await publishReportRecord({ reportPath, report });
  await updateLatestReport({ imagePath, repositoryRoot, report });
  return { cardUrl, reportPath, imagePath, imageSha256 };
}
