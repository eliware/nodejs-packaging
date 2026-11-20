import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import renderReleaseCardHtml from "./html.mjs";
import renderCard from "./render-card.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default async function createReportCard({
  runId,
  repositoryRoot,
  status,
  statusColor,
  details,
  reason,
  changed,
  renderImage = renderCard,
}) {
  const directory = path.join(repositoryRoot, "metadata/runs", runId);
  await mkdir(directory, { recursive: true });
  const logo = await readFile(path.join(root, "assets/eliware-brand.svg"));
  const logoData = `data:image/svg+xml;base64,${logo.toString("base64")}`;
  const html = renderReleaseCardHtml({
    logoData,
    status,
    statusColor,
    details,
    runId,
    reason,
    changed,
  });
  const htmlPath = path.join(directory, "release-card.html");
  const imagePath = path.join(directory, "release-card.png");
  await writeFile(htmlPath, html);
  const imageSha256 = await renderImage(htmlPath, imagePath);
  return { htmlPath, imagePath, imageSha256 };
}
