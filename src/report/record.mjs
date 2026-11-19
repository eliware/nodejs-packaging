function createReportDetails({
  nodeVersion,
  npmVersion,
  baseDigest,
  imageDigest,
  rpmSha256,
  reason,
}) {
  return [
    ["Node.js", `v${nodeVersion}`],
    ["npm", npmVersion],
    ["Base image", baseDigest],
    ["Container", `ghcr.io/eliware/centos10-node26@${imageDigest || "not rebuilt"}`],
    ["RPM SHA-256", rpmSha256 || "unchanged"],
    ["Decision", reason],
  ];
}

function createReportRecord({
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
  now = new Date(),
}) {
  const cardUrl = `${baseUrl}/metadata/runs/${runId}/release-card.png`;
  return {
    cardUrl,
    report: {
      metadata_version: "0.1.0",
      schema: 1,
      run_id: runId,
      generated: now.toISOString(),
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
    },
  };
}

export default function reportRecordModule() {
  return { createReportDetails, createReportRecord };
}
