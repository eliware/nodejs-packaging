import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import redactCommandOutput from "./redact.mjs";

export default async function writeCommandLog({
  file,
  name,
  stdout = "",
  stderr = "",
  env = process.env,
}) {
  const safeStdout = redactCommandOutput(stdout, env);
  const safeStderr = redactCommandOutput(stderr, env);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    `Command: ${name}\n\n--- stdout ---\n${safeStdout}\n--- stderr ---\n${safeStderr}\n`,
  );
  return { stdout: safeStdout, stderr: safeStderr };
}
