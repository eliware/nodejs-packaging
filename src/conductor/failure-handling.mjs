import setFailureExitStatus from "./failure/exit-status.mjs";
import reportConductorFailure from "./failure/report.mjs";

export default async function runConductorBoundary({
  run,
  getFailureState,
  cleanup,
  log = console,
  reportFailure = reportConductorFailure,
}) {
  try {
    return await run();
  } catch (error) {
    const failureState = getFailureState();
    setFailureExitStatus();
    await reportFailure({ error, ...failureState, log });
  } finally {
    await cleanup();
  }
}
