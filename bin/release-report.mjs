import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );

export async function generateReleaseReport({
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
  const statusColor = changed ? "#55d68a" : "#8fb7dc";
  const details = [
    ["Node.js", `v${nodeVersion}`],
    ["npm", npmVersion],
    ["Base image", baseDigest],
    ["Container", `ghcr.io/eliware/centos10-node26@${imageDigest || "not rebuilt"}`],
    ["RPM SHA-256", rpmSha256 || "unchanged"],
    ["Decision", reason],
  ];
  const rows = details
    .map(
      ([label, value]) =>
        `<div class="row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`,
    )
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:1200px;height:630px;color:#f4f8ff;background:#08111f;font-family:Arial,sans-serif}.card{height:100%;padding:52px 64px;background:radial-gradient(circle at 88% 12%,#17446c 0,#0d2038 32%,#08111f 72%);position:relative;overflow:hidden}.brand{display:flex;align-items:center;gap:16px}.brand img{width:48px;height:48px}.eyebrow{color:#8fb7dc;font-size:17px;letter-spacing:.17em;text-transform:uppercase}.stamp{position:absolute;top:54px;right:68px;border:3px solid ${statusColor};color:${statusColor};border-radius:999px;padding:13px 20px;font-weight:900;letter-spacing:.06em;font-size:16px;transform:rotate(3deg)}h1{margin:32px 0 8px;font-size:48px;line-height:1.05}.subtitle{color:#b7cbe0;font-size:21px}.stats{display:flex;gap:16px;margin-top:27px}.stat{min-width:210px;padding:15px 19px;border:1px solid rgba(143,183,220,.25);border-radius:12px;background:rgba(13,32,56,.7)}.stat strong{display:block;font-size:23px;color:#55d68a}.stat span{color:#a9c1d9;font-size:14px}.rows{margin-top:22px;border:1px solid rgba(143,183,220,.25);border-radius:14px;overflow:hidden;background:rgba(8,17,31,.55)}.row{display:grid;grid-template-columns:180px 1fr;gap:14px;padding:8px 16px;border-top:1px solid rgba(143,183,220,.13);font-size:15px}.row:first-child{border:0}.row span{color:#8fb7dc}.row strong{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.footer{position:absolute;left:64px;right:64px;bottom:24px;display:flex;justify-content:space-between;color:#7797b7;font-size:13px}
</style></head><body><main class="card"><div class="stamp">${status}</div><div class="brand"><img src="${logoData}" alt="Eliware"><div><div class="eyebrow">Eliware · Release Conductor</div><div style="font-size:20px;font-weight:700">Node.js 26 packaging</div></div></div><h1>Verified release pipeline</h1><div class="subtitle">Run ${escapeHtml(runId)} · ${escapeHtml(reason)}</div><div class="stats"><div class="stat"><strong>CentOS Stream 10</strong><span>x86_64 · EPEL RPM</span></div><div class="stat"><strong>${changed ? "Published" : "Current"}</strong><span>GHCR runtime image</span></div><div class="stat"><strong>Validated</strong><span>signatures · smoke checks</span></div></div><section class="rows">${rows}</section><div class="footer"><span>nodejs.eliware.org</span><span>Official Node.js binaries · signed artifacts</span></div></main></body></html>`;
  const htmlPath = path.join(directory, "release-card.html");
  const imagePath = path.join(directory, "release-card.png");
  await writeFile(htmlPath, html);
  const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
  const render = spawnSync(
    chrome,
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--window-size=1200,630",
      `--screenshot=${imagePath}`,
      `file://${htmlPath}`,
    ],
    { encoding: "utf8", timeout: 60_000 },
  );
  if (render.error) throw render.error;
  if (render.status !== 0) throw new Error(`release-card rendering failed: ${render.stderr}`);
  const imageSha256 = await hashFile(imagePath);
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
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await copyFile(imagePath, path.join(repositoryRoot, "metadata/latest-release-card.png"));
  await writeFile(
    path.join(repositoryRoot, "metadata/latest-release-report.json"),
    `${JSON.stringify({ metadata_version: "0.1.0", schema: 1, run_id: runId, report: `${baseUrl}/metadata/runs/${runId}/release-report.json`, card: report.card.latest }, null, 2)}\n`,
  );
  return { cardUrl, reportPath, imagePath, imageSha256 };
}

async function hashFile(file) {
  const hash = createHash("sha256");
  const { createReadStream } = await import("node:fs");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
