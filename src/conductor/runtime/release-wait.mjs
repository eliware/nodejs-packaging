export default async function waitForPublishedRelease(
  { repositoryUrl, getJson },
  version,
  npmVersion,
) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const catalog = await getJson(
        `${repositoryUrl}/metadata/catalog.json?version=${version}&attempt=${attempt}`,
      );
      if (
        catalog.stable?.latest?.node_version === version &&
        catalog.stable?.latest?.npm?.version === npmVersion
      )
        return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(
    `published catalog did not expose Node.js ${version} and npm ${npmVersion} after 60 seconds`,
  );
}
