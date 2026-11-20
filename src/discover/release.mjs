const RELEASE_INDEX_URL = "https://nodejs.org/dist/index.json";

function numericVersion(version) {
  const match = /^v(26)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) return null;
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

export default async function discoverLatestRelease(fetchImpl = fetch, requestedVersion = null) {
  const response = await fetchImpl(RELEASE_INDEX_URL, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Node.js release index returned HTTP ${response.status}`);

  const releases = await response.json();
  if (!Array.isArray(releases)) throw new Error("Node.js release index must contain an array");

  const latest = releases
    .map((release) => ({ release, version: numericVersion(release?.version) }))
    .filter(
      ({ release, version }) =>
        version &&
        release.files?.includes("linux-x64") &&
        (!requestedVersion || release.version === `v${requestedVersion}`),
    )
    .sort((left, right) => compareVersions(right.version, left.version))[0];

  if (!latest)
    throw new Error(
      requestedVersion
        ? `Node.js release index has no stable Node.js ${requestedVersion} x64 release`
        : "Node.js release index has no stable Node.js 26 x64 release",
    );

  const version = latest.release.version.slice(1);
  const directory = `https://nodejs.org/dist/${latest.release.version}/`;
  return {
    metadata_version: "0.1.0",
    schema: 1,
    node_version: version,
    released: latest.release.date,
    source: {
      file: `node-v${version}-linux-x64.tar.xz`,
      url: `${directory}node-v${version}-linux-x64.tar.xz`,
      checksums_file: "SHASUMS256.txt",
      checksums_url: `${directory}SHASUMS256.txt`,
      signature_file: "SHASUMS256.txt.sig",
      signature_url: `${directory}SHASUMS256.txt.sig`,
    },
  };
}
