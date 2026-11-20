function versionParts(value, requiredMajor = null) {
  const match = /^(\d+)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value || "");
  if (!match) return null;
  const parts = match.map(Number).slice(1);
  if (requiredMajor !== null && parts[0] !== requiredMajor) return null;
  return parts;
}

function npmVersionParts(value) {
  const parts = versionParts(value);
  return parts && parts[0] >= 12 ? parts : null;
}

function compareParts(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function compareNodeVersions(left, right) {
  const a = versionParts(left, 26);
  const b = versionParts(right, 26);
  if (!a || !b) throw new Error("Node.js versions must use the 26.x.y format");
  return compareParts(a, b);
}

function compareNpmVersions(left, right) {
  const a = npmVersionParts(left);
  const b = npmVersionParts(right);
  if (!a || !b) throw new Error("npm versions must use the 12.0.0 or later format");
  return compareParts(a, b);
}

export default function planRelease({
  latestNodeVersion,
  publishedNodeVersion,
  latestNpmVersion,
  publishedNpmVersion,
  publishedBaseImageDigest,
  currentBaseImageDigest,
  publishedImageDigest,
}) {
  const nodeUpdate =
    !publishedNodeVersion || compareNodeVersions(latestNodeVersion, publishedNodeVersion) > 0;
  if (publishedNodeVersion && compareNodeVersions(latestNodeVersion, publishedNodeVersion) < 0)
    throw new Error("discovered Node.js version is older than the published version");
  const npmUpdate =
    !publishedNpmVersion || compareNpmVersions(latestNpmVersion, publishedNpmVersion) > 0;
  const baseImageUpdate =
    !publishedImageDigest || publishedBaseImageDigest !== currentBaseImageDigest;
  const buildRpm = nodeUpdate || npmUpdate;
  const buildImage = buildRpm || baseImageUpdate;
  const reason =
    nodeUpdate && npmUpdate
      ? "nodejs-and-npm-update"
      : nodeUpdate
        ? "nodejs-update"
        : npmUpdate
          ? "npm-update"
          : baseImageUpdate
            ? "base-image-update"
            : "no-updates";
  return {
    nodeUpdate,
    npmUpdate,
    baseImageUpdate,
    buildRpm,
    buildImage,
    noOp: !buildImage,
    reason,
  };
}
