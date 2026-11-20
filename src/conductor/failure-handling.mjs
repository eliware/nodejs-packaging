export default async function runConductorBoundary({
  run,
  getFailureState,
  cleanup,
  log = console,
}) {
  try {
    return await run();
  } catch (error) {
    const { stage, dryRun, runId, notifyConductor } = getFailureState();
    log.error(`[conductor] ${stage} failed: ${error.message}`);
    process.exitCode = 1;
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
  } finally {
    await cleanup();
  }
}
