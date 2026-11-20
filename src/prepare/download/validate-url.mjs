export default function validateDownloadUrl(url, trustedHosts) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !trustedHosts.includes(parsed.hostname))
    throw new Error(`download left the trusted HTTPS hosts: ${url}`);
  return parsed;
}
