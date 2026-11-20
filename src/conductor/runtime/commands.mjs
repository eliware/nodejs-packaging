import path from "node:path";

export default function conductorCommands({ root, commands, runId }) {
  let sequence = 0;
  const logOptions = (name) =>
    runId
      ? {
          logPath: path.join(
            root,
            "artifacts/logs",
            runId,
            `${String(++sequence).padStart(3, "0")}-${name}.log`,
          ),
          logName: name,
        }
      : {};
  const runEnvironment = (extra = {}) => ({
    ...process.env,
    ...extra,
    ...(runId
      ? {
          NODEJS_CONDUCTOR_LOG_DIR: path.join(root, "artifacts/logs", runId),
          NODEJS_CONDUCTOR_RUN_ID: runId,
        }
      : {}),
  });
  const { runCommand, runCommandCapture } = commands;

  async function runNode(script, args = [], extraEnv = {}) {
    return runCommand(process.execPath, [path.join(root, script), ...args], {
      cwd: root,
      ...logOptions(path.basename(script, ".mjs")),
      env: runEnvironment(extraEnv),
    });
  }

  async function runNodeCapture(script, args = []) {
    return runCommandCapture(process.execPath, [path.join(root, script), ...args], {
      cwd: root,
      ...logOptions(path.basename(script, ".mjs")),
      ...(runId ? { env: runEnvironment() } : {}),
    });
  }

  return { runNode, runNodeCapture };
}
