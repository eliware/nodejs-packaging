import discoverLatestRelease from "./release.mjs";
import formatDiscoveredRelease from "./format.mjs";

export default async function discoverReleaseCommand(fetchImpl = fetch) {
  return formatDiscoveredRelease(await discoverLatestRelease(fetchImpl));
}
