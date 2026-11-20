#!/usr/bin/env node
import createConductorConfig from "./conductor/config.mjs";
import discoverLatestRelease from "./discover/release.mjs";
import discoverLatestNpm from "./discover/npm.mjs";
import prepareReleasePlan from "./conductor/release/plan.mjs";
import discordNotifierModule from "./discord-notifier.mjs";
const { hasDiscordWebhook, notifyConductor } = discordNotifierModule();
import generateReleaseReport from "./report/generate.mjs";
import runRelease from "./conductor/release/run.mjs";
import conductorRuntime from "./conductor/runtime.mjs";
import conductorCommandsModule from "./conductor/commands.mjs";
import runConductorBoundary from "./conductor/failure-handling.mjs";
const commands = conductorCommandsModule();
export default async function main(argv = process.argv.slice(2), env = process.env) {
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
  await runConductorBoundary({
    run: async () => {
      lockHeld = await acquireLock(lockPath);
      if (!dryRun && !hasDiscordWebhook())
        throw new Error("DISCORD_WEBHOOK is not configured in the conductor environment");
      if (!repositoryUrl.startsWith("https://"))
        throw new Error("NODEJS_REPOSITORY_URL must use HTTPS");
      const { release, npmRelease, currentBaseDigest, plan, nodeVersion } =
        await prepareReleasePlan({
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
    },
    getFailureState: () => ({ stage, dryRun, runId, notifyConductor }),
    cleanup: async () => {
      if (lockHeld) await releaseLock(lockPath);
    },
  });
}
