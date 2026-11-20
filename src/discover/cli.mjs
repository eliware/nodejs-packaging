import discoverLatestRelease from "./release.mjs";

export default async function discoverReleaseCommand(fetchImpl = fetch) {
  const release = await discoverLatestRelease(fetchImpl);
  return `${JSON.stringify(release, null, 2)}\n`;
}
