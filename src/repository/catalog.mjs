export default async function loadPublishedRelease(version, repositoryUrl, fetchImpl) {
  if (!repositoryUrl)
    throw new Error("set NODEJS_REPOSITORY_URL to the production Node.js HTTP service");
  const parsedRepositoryUrl = new URL(repositoryUrl);
  if (
    parsedRepositoryUrl.protocol !== "https:" ||
    parsedRepositoryUrl.username ||
    parsedRepositoryUrl.password
  )
    throw new Error("NODEJS_REPOSITORY_URL must use HTTPS and contain no credentials");
  if (
    parsedRepositoryUrl.pathname !== "/" ||
    parsedRepositoryUrl.search ||
    parsedRepositoryUrl.hash
  )
    throw new Error("NODEJS_REPOSITORY_URL must name the production service root");

  const repositoryBase = parsedRepositoryUrl.href.replace(/\/$/, "");
  const catalogResponse = await fetchImpl(`${repositoryBase}/metadata/catalog.json`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!catalogResponse.ok)
    throw new Error(
      `Node.js HTTP service returned HTTP ${catalogResponse.status} for the release catalog`,
    );
  const catalog = await catalogResponse.json();
  if (
    catalog.metadata_version !== "0.1.0" ||
    catalog.node_major !== 26 ||
    catalog.target?.architecture !== "x86_64"
  )
    throw new Error("production catalog does not match the Node.js 26 x86_64 release contract");
  const publishedRelease = catalog.stable?.latest;
  if (
    publishedRelease?.node_version !== version ||
    publishedRelease.package?.name !== "eliware-node26"
  )
    throw new Error(`production repository does not publish eliware-node26 ${version}`);
  if (!/^[a-f\d]{64}$/.test(publishedRelease.package.sha256 || ""))
    throw new Error("production catalog does not provide a valid RPM checksum");
  return { repositoryBase, publishedRelease };
}
