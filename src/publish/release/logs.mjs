import { cp } from "node:fs/promises";
import path from "node:path";

export default async function copyReleaseLogs(stagingRoot, env = process.env) {
  const logDirectory = env.NODEJS_CONDUCTOR_LOG_DIR;
  const runId = env.NODEJS_CONDUCTOR_RUN_ID;
  if (logDirectory && runId)
    await cp(logDirectory, path.join(stagingRoot, "metadata/logs", runId), {
      recursive: true,
      force: true,
    });
}
