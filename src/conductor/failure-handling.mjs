import setFailureExitStatus from "./failure/exit-status.mjs";
import reportConductorFailure from "./failure/report.mjs";

export default async function runConductorBoundary({
  run,
  getFailureState,
  cleanup,
  log = console,
  reportFailure = reportConductorFailure,
}) {
  let failure;
  try {
    return await run();
  } catch (error) {
    failure = error;
    const failureState = getFailureState();
    setFailureExitStatus();
    await reportFailure({ error, ...failureState, log });
  } finally {
    try {
      await cleanup();
    } catch (error) {
      setFailureExitStatus();
      if (failure) log.error(`[conductor] cleanup failed: ${error.message}`);
      else await reportFailure({ error, ...getFailureState(), log });
    }
  }
}
