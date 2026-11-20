export default async function reportConductorFailure({
  error,
  stage,
  dryRun,
  runId,
  notifyConductor,
  log,
  service = process.env.NODEJS_CONDUCTOR_SERVICE,
}) {
  log.error(`[conductor] ${stage} failed: ${error.message}`);
  if (!dryRun && service !== "true")
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
}
