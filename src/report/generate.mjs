import publishReportRecord from "./publish.mjs";
import createReportDetails from "./details.mjs";
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
