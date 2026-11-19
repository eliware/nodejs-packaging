function versionParts(value) {
  const match = /^26\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value || "");
  return match ? match.slice(1).map(Number) : null;
}

export function compareNodeVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  if (!a || !b) throw new Error("Node.js versions must use the 26.x.y format");
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

export function planRelease({
  latestNodeVersion,
  publishedNodeVersion,
  publishedBaseImageDigest,
  currentBaseImageDigest,
  publishedImageDigest,
}) {
  const packageMissing = !publishedNodeVersion;
  const nodeUpdate = packageMissing || compareNodeVersions(latestNodeVersion, publishedNodeVersion) > 0;
  const imageMissing = !publishedImageDigest;
  const baseImageUpdate = !imageMissing && publishedBaseImageDigest !== currentBaseImageDigest;
  const buildImage = nodeUpdate || imageMissing || baseImageUpdate;
  return {
    nodeUpdate,
    baseImageUpdate,
    buildRpm: nodeUpdate,
    buildImage,
    noOp: !buildImage,
    reason: nodeUpdate ? "nodejs-update" : imageMissing ? "image-baseline" : baseImageUpdate ? "base-image-update" : "no-updates",
  };
}
