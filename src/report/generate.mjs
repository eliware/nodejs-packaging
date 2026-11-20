import path from "node:path";
import publishReportRecord from "./publish.mjs";
import updateLatestReport from "./latest.mjs";
import reportRecordModule from "./record.mjs";
import createReportDetails from "./details.mjs";
import createReportCard from "./card.mjs";

const { createReportRecord } = reportRecordModule();

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
  const status = changed ? "✓ RELEASE COMPLETE" : "✓ NO UPDATES";
  const details = createReportDetails({
    nodeVersion,
    npmVersion,
    baseDigest,
    imageDigest,
    rpmSha256,
    reason,
  });
  const card = await createReportCard({
    runId,
    repositoryRoot,
    status,
    statusColor: changed ? "#55d68a" : "#8fb7dc",
    details,
    reason,
    changed,
  });
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
    imageSha256: card.imageSha256,
  });
  const reportPath = path.join(repositoryRoot, "metadata/runs", runId, "release-report.json");
  await publishReportRecord({ reportPath, report });
  await updateLatestReport({ imagePath: card.imagePath, repositoryRoot, report });
  return { cardUrl, reportPath, ...card };
}
