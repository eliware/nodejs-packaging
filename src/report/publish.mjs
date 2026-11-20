import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import updateLatestReport from "./latest.mjs";
import reportRecordModule from "./record.mjs";

const { createReportRecord } = reportRecordModule();

export default async function publishReport({
  runId,
  repositoryRoot,
  imagePath,
  nodeVersion,
  npmVersion,
  baseDigest,
  imageDigest,
  imageId,
  rpmSha256,
  reason,
  changed,
  imageSha256,
  baseUrl = process.env.NODEJS_REPOSITORY_URL || "https://nodejs.eliware.org",
}) {
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
  const reportPath = path.join(repositoryRoot, "metadata/runs", runId, "release-report.json");
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await updateLatestReport({ imagePath, repositoryRoot, report });
  return { cardUrl, reportPath, report };
}
