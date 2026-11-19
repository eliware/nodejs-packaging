#!/usr/bin/env node
import conductorConfigModule from "./conductor/config.mjs";
import discoverReleaseModule from "./discover/release.mjs";
const { discoverLatestRelease } = discoverReleaseModule();
import discoverNpmModule from "./discover/npm.mjs";
const { discoverLatestNpm } = discoverNpmModule();
import conductorReleasePlanModule from "./conductor/release/plan.mjs";
import discordNotifierModule from "./discord-notifier.mjs";
const { hasDiscordWebhook, notifyConductor } = discordNotifierModule();
import releaseReportModule from "./release-report.mjs";
import conductorReleaseModule from "./conductor/release/run.mjs";
import conductorRuntimeModule from "./conductor/runtime.mjs";
import conductorCommandsModule from "./conductor/commands.mjs";
const { generateReleaseReport } = releaseReportModule();
const { runRelease } = conductorReleaseModule();
const { conductorRuntime } = conductorRuntimeModule();
const commands = conductorCommandsModule();
const { prepareReleasePlan } = conductorReleasePlanModule();
const { createConductorConfig } = conductorConfigModule();

async function main(argv = process.argv.slice(2), env = process.env) {
  await runConductor(createConductorConfig(argv, env));
}

async function runConductor({
  root,
  repositoryRoot,
  repositoryUrl,
  baseImage,
  dryRun,
  stateRoot,
  lockPath,
  runId,
}) {
  let stage = "preflight";
  let lockHeld = false;
  const runtime = conductorRuntime({
    root,
    stateRoot,
    repositoryUrl,
    baseImage,
    runId,
    notifyConductor,
    commands,
  });
  const { checkpoint, acquireLock, releaseLock, saveState, getJson } = runtime;
  const { getBaseImageDigest, waitForPublishedRelease, runNode, runNodeCapture } = runtime;
  try {
    lockHeld = await acquireLock(lockPath);
    if (!dryRun && !hasDiscordWebhook())
      throw new Error("DISCORD_WEBHOOK is not configured in the conductor environment");
    if (!repositoryUrl.startsWith("https://"))
      throw new Error("NODEJS_REPOSITORY_URL must use HTTPS");
    const { release, npmRelease, currentBaseDigest, plan, nodeVersion } = await prepareReleasePlan({
      repositoryUrl,
      runId,
      getJson,
      getBaseImageDigest,
      saveState,
      setStage: (value) => {
        stage = value;
      },
      discoverNode: discoverLatestRelease,
      discoverNpm: discoverLatestNpm,
    });
    if (dryRun) {
      console.log(
        `[conductor] dry-run passed; ${plan.noOp ? "no build is needed" : `would build RPM=${plan.buildRpm} and image=${plan.buildImage}`}`,
      );
      return;
    }
    if (plan.noOp) {
      stage = "repository-commit-push";
      await runNode("bin/commit-publish-repository.mjs", [], {
        NODEJS_REPOSITORY_ROOT: repositoryRoot,
      });
      await notifyConductor({
        title: "No updates available",
        description: "No updates were found. No packages, images, or repository files changed.",
        status: "success",
        fields: [
          { name: "Run", value: runId },
          { name: "Status", value: "No-op" },
          { name: "Node.js", value: release.node_version },
          { name: "npm", value: npmRelease.version },
        ],
      });
      return;
    }

    await runRelease({
      plan,
      nodeVersion,
      release,
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
      setStage: (value) => {
        stage = value;
      },
    });
  } catch (error) {
    console.error(`[conductor] ${stage} failed: ${error.message}`);
    if (!dryRun && process.env.NODEJS_CONDUCTOR_SERVICE !== "true")
      await notifyConductor({
        title: `Node.js conductor ${stage} failed`,
        description:
          "The release stopped at this checkpoint. The next timer run can retry after the reported issue is fixed.",
        status: "failure",
        fields: [
          { name: "Run", value: runId },
          { name: "Stage", value: stage },
          { name: "Error", value: error.message },
        ],
      });
    process.exitCode = 1;
  } finally {
    if (lockHeld) await releaseLock(lockPath);
  }
}

export default function moduleApi() {
  return { main };
}
