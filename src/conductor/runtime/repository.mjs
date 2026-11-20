import conductorDockerImage from "./docker-image.mjs";

export default function conductorRepository({
  repositoryUrl,
  baseImage,
  runCommand,
  runCommandCapture,
}) {
  async function getJson(url) {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`${new URL(url).pathname} returned HTTP ${response.status}`);
    return response.json();
  }

  async function waitForPublishedRelease(version, npmVersion) {
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

  return {
    getJson,
    ...conductorDockerImage({ baseImage, runCommand, runCommandCapture }),
    waitForPublishedRelease,
  };
}
