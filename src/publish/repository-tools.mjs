import { spawnSync } from "node:child_process";
import path from "node:path";
import writeCommandLog from "../conductor/commands/log.mjs";
import redactCommandOutput from "../conductor/commands/redact.mjs";

export default async function runRepositoryTool({
  command,
  args,
  extraEnv = {},
  stagingRoot,
  output,
  env = process.env,
}) {
  const commandEnv = { ...env, ...extraEnv };
  const result = spawnSync(command, args, { encoding: "utf8", env: commandEnv });
  if (result.error) {
    output.push(`${command}: ${result.error.message}`);
    await writeRepositoryToolLog({ output, stagingRoot, env: commandEnv });
    throw result.error;
  }
  output.push(`$ ${command}\n${result.stdout || ""}${result.stderr || ""}`);
  await writeRepositoryToolLog({ output, stagingRoot, env: commandEnv });
  if (result.status !== 0)
    throw new Error(
      `${command} exited with status ${result.status}: ${redactCommandOutput(result.stderr || "", commandEnv)}`,
    );
  return result;
}

async function writeRepositoryToolLog({ output, stagingRoot, env }) {
  const logDirectory = env.NODEJS_CONDUCTOR_LOG_DIR;
  const runId = env.NODEJS_CONDUCTOR_RUN_ID;
  if (!logDirectory || !runId) return;
  await writeCommandLog({
    file: path.join(stagingRoot, "metadata/logs", runId, "repository-tools.log"),
    name: "repository tools",
    stdout: redactCommandOutput(output.join("\n"), env),
  });
}
