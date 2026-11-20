import { cp } from "node:fs/promises";
import path from "node:path";

export default async function copyConductorLogs(
  stagingRoot,
  logDirectory = process.env.NODEJS_CONDUCTOR_LOG_DIR,
  runId = process.env.NODEJS_CONDUCTOR_RUN_ID,
) {
  if (logDirectory && runId)
    await cp(logDirectory, path.join(stagingRoot, "metadata/logs", runId), {
      recursive: true,
      force: true,
    });
}
