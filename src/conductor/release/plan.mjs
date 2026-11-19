import planRelease from "../plan.mjs";

async function prepareReleasePlan({
  repositoryUrl,
  runId,
  getJson,
  getBaseImageDigest,
  saveState,
  setStage,
  discoverNode,
  discoverNpm,
}) {
  const readiness = await getJson(`${repositoryUrl}/readyz`);
  if (readiness.status !== "ready") throw new Error("Node.js repository service is not ready");
  const catalog = await getJson(`${repositoryUrl}/metadata/catalog.json?run=${runId}`);
  if (catalog.metadata_version !== "0.1.0" || catalog.node_major !== 26)
    throw new Error("published catalog does not match the Node.js 26 release contract");

  setStage("upstream-check");
  const [release, npmRelease, currentBaseDigest] = await Promise.all([
    discoverNode(),
    discoverNpm(),
    getBaseImageDigest(),
  ]);
  const published = catalog.stable?.latest;
  const publishedImage =
    catalog.images?.find((image) => image.node_version === published?.node_version) ||
    published?.image ||
    null;
  const plan = planRelease({
    latestNodeVersion: release.node_version,
    publishedNodeVersion: published?.node_version || null,
    latestNpmVersion: npmRelease.version,
    publishedNpmVersion: published?.npm?.version || null,
    publishedBaseImageDigest: publishedImage?.base_image_digest || null,
    currentBaseImageDigest: currentBaseDigest,
    publishedImageDigest: publishedImage?.digest || null,
  });
  const nodeVersion = plan.buildRpm ? release.node_version : published?.node_version;
  if (!nodeVersion)
    throw new Error("no Node.js RPM is published and discovery returned no version");
  await saveState({
    run_id: runId,
    stage: "upstream-check",
    node_version: release.node_version,
    npm_version: npmRelease.version,
    base_image_digest: currentBaseDigest,
    plan,
  });
  console.log(
    `[conductor] run=${runId} node=${release.node_version} base=${currentBaseDigest} plan=${plan.reason}`,
  );
  return { catalog, release, npmRelease, currentBaseDigest, plan, nodeVersion };
}

export default function conductorReleasePlanModule() {
  return { prepareReleasePlan };
}
