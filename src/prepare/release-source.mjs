export default async function resolveReleaseVersion(
  requestedVersion,
  selected,
  allowOlder,
  discoverLatestRelease,
) {
  if (selected.node_version === requestedVersion || !allowOlder) return selected;
  const release = await discoverLatestRelease(requestedVersion);
  if (release.node_version !== requestedVersion)
    throw new Error(`Node.js ${requestedVersion} is not an available stable release`);
  return release;
}
