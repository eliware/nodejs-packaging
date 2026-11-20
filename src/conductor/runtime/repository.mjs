import conductorDockerImage from "./docker-image.mjs";
import waitForPublishedRelease from "./release-wait.mjs";

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

  return {
    getJson,
    ...conductorDockerImage({ baseImage, runCommand, runCommandCapture }),
    waitForPublishedRelease: (version, npmVersion) =>
      waitForPublishedRelease({ repositoryUrl, getJson }, version, npmVersion),
  };
}
