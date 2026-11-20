import publishReportRecord from "./publish.mjs";
import createReportSummary from "./summary.mjs";
import createReportCard from "./card.mjs";

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
  const { status, statusColor, details } = createReportSummary({
    nodeVersion,
    npmVersion,
    baseDigest,
    imageDigest,
    rpmSha256,
    reason,
    changed,
  });
  const card = await createReportCard({
    runId,
    repositoryRoot,
    status,
    statusColor,
    details,
    reason,
    changed,
  });
  const publication = await publishReportRecord({
    runId,
    repositoryRoot,
    imagePath: card.imagePath,
    nodeVersion,
    npmVersion,
    baseDigest,
    imageDigest,
    imageId,
    rpmSha256,
    reason,
    changed,
    imageSha256: card.imageSha256,
  });
  return { ...publication, ...card };
}
