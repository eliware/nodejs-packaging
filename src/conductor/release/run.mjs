import { readFile } from "node:fs/promises";
import path from "node:path";

async function runRelease(options) {
  const {
    plan,
    nodeVersion,
    npmRelease,
    currentBaseDigest,
    repositoryRoot,
    root,
    runId,
    runNode,
    runNodeCapture,
    waitForPublishedRelease,
    saveState,
    checkpoint,
    generateReleaseReport,
    notifyConductor,
    setStage,
  } = options;
  if (plan.buildRpm) {
    setStage("package-build");
    await runNode("bin/prepare-release.mjs", [
      "--version",
      nodeVersion,
      "--npm-version",
      npmRelease.version,
    ]);
    await runNode("bin/build-rpm.mjs", ["--version", nodeVersion]);
    const candidateResult = await runNodeCapture("bin/generate-repository.mjs", [
      "--version",
      nodeVersion,
    ]);
    const candidate = JSON.parse(candidateResult.stdout).output;
    await runNode("bin/publish-release.mjs", [
      "--version",
      nodeVersion,
      "--candidate",
      candidate,
      "--repository",
      repositoryRoot,
    ]);
    await waitForPublishedRelease(nodeVersion, npmRelease.version);
    await saveState({
      run_id: runId,
      stage: "package-published",
      node_version: nodeVersion,
      npm_version: npmRelease.version,
      base_image_digest: currentBaseDigest,
      candidate,
    });
    await checkpoint(
      "RPM checkpoint passed",
      "The official Node.js archive verified, the RPM built, and the signed repository generation became active.",
      [
        { name: "Node.js", value: nodeVersion },
        { name: "npm", value: npmRelease.version },
        { name: "Target", value: "CentOS Stream 10 EPEL x86_64" },
      ],
    );
  }

  setStage("image-build-publish");
  await runNode("bin/build-image.mjs", [
    "--version",
    nodeVersion,
    "--base-digest",
    currentBaseDigest,
    "--push",
  ]);
  const imageRecordPath = path.join(root, "artifacts/images", nodeVersion, "image.json");
  const image = JSON.parse(await readFile(imageRecordPath, "utf8"));
  if (!image.digest || image.published !== true)
    throw new Error("image build did not record a successful GHCR publication");
  if (image.base_image_digest !== currentBaseDigest)
    throw new Error("image base digest does not match the current release plan");
  await checkpoint(
    "Image checkpoint passed",
    "The CentOS Stream 10 image passed its Node.js smoke check and the GHCR push returned a digest.",
    [
      { name: "Image", value: `${image.repository}:${image.tag}` },
      { name: "Digest", value: image.digest },
      { name: "Base image", value: image.base_image_digest },
    ],
  );

  setStage("image-metadata");
  await runNode("bin/publish-image-record.mjs", [imageRecordPath]);
  const active = JSON.parse(
    await readFile(path.join(repositoryRoot, "metadata/active-generation.json"), "utf8"),
  );
  setStage("release-report");
  const releaseReport = await generateReleaseReport({
    runId,
    repositoryRoot,
    nodeVersion,
    npmVersion: npmRelease.version,
    baseDigest: currentBaseDigest,
    imageDigest: image.digest,
    imageId: image.local_image_id,
    rpmSha256: image.rpm_sha256,
    reason: plan.reason,
    changed: true,
  });
  setStage("repository-commit-push");
  await runNode("bin/commit-publish-repository.mjs", [], {
    NODEJS_REPOSITORY_ROOT: repositoryRoot,
  });
  await notifyConductor({
    title: "Node.js conductor run completed",
    description:
      "The release checks, required package and image work, signed metadata, repository commit, and push completed successfully.",
    status: "success",
    fields: [
      { name: "Run", value: runId },
      { name: "Node.js", value: nodeVersion },
      { name: "npm", value: npmRelease.version },
      { name: "Plan", value: plan.reason },
      { name: "RPM", value: image.rpm_sha256 },
      { name: "Image", value: `${image.repository}:${image.tag}` },
      { name: "Digest", value: image.digest },
      { name: "Base image", value: currentBaseDigest },
      { name: "Repository generation", value: active.generation },
      { name: "Release report", value: releaseReport.cardUrl },
    ],
    cardUrl: releaseReport.cardUrl,
  });
  try {
    await saveState({
      run_id: runId,
      stage: "complete",
      node_version: nodeVersion,
      npm_version: npmRelease.version,
      base_image_digest: currentBaseDigest,
      image_digest: image.digest,
      generation: active.generation,
      completed: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      `[conductor] release completed but final state could not be saved: ${error.message}`,
    );
  }
}

export default function conductorReleaseModule() {
  return { runRelease };
}
