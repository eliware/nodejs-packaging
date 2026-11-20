export default async function runConductorService({ run, notify, log = console }) {
  let phase = "dry-run";
  try {
    log.info("[conductor-service] starting dry-run preflight");
    await run("--dry-run");
    phase = "wet-run";
    log.info("[conductor-service] dry-run passed. Starting wet-run.");
    await run("--wet-run");
    log.info("[conductor-service] wet-run completed");
    return true;
  } catch (error) {
    log.error(`[conductor-service] ${phase} failed: ${error.message}`);
    try {
      await notify({
        title: `Node.js conductor ${phase} failed`,
        description:
          phase === "dry-run"
            ? "The preflight failed. The release run did not start."
            : "The release run stopped after preflight.",
        status: "failure",
        fields: [
          { name: "Phase", value: phase },
          { name: "Error", value: error.message },
        ],
      });
    } catch (notificationError) {
      log.error(`[conductor-service] failure notification failed: ${notificationError.message}`);
    }
    return false;
  }
}
