export default function formatDiscoveredRelease(release) {
  return `${JSON.stringify(release, null, 2)}\n`;
}
