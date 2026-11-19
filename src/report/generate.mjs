import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import reportHtmlModule from "./html.mjs";
import renderCardModule from "./render-card.mjs";
import reportPublishModule from "./publish.mjs";

const { renderReleaseCardHtml } = reportHtmlModule();
const { renderCard } = renderCardModule();
const { publishReport } = reportPublishModule();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function generateReleaseReport({
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
  const details = [
    ["Node.js", `v${nodeVersion}`],
    ["npm", npmVersion],
    ["Base image", baseDigest],
    ["Container", `ghcr.io/eliware/centos10-node26@${imageDigest || "not rebuilt"}`],
    ["RPM SHA-256", rpmSha256 || "unchanged"],
    ["Decision", reason],
  ];
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
  const cardUrl = `${baseUrl}/metadata/runs/${runId}/release-card.png`;
  const report = {
    metadata_version: "0.1.0",
    schema: 1,
    run_id: runId,
    generated: new Date().toISOString(),
    status: changed ? "certified" : "no_updates",
    reason,
    node_version: nodeVersion,
    npm_version: npmVersion,
    base_image_digest: baseDigest,
    image_digest: imageDigest || null,
    image_id: imageId || null,
    rpm_sha256: rpmSha256 || null,
    card: {
      png: cardUrl,
      latest: `${baseUrl}/metadata/latest-release-card.png`,
      width: 1200,
      height: 630,
      type: "image/png",
      sha256: imageSha256,
    },
  };
  const reportPath = path.join(directory, "release-report.json");
  await publishReport({ reportPath, imagePath, repositoryRoot, report });
  return { cardUrl, reportPath, imagePath, imageSha256 };
}

export default function reportGenerateModule() {
  return { generateReleaseReport };
}
