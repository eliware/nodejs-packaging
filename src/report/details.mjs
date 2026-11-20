export default function createReportDetails({
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
