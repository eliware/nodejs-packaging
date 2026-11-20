import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { redactText } from "@eliware/common";

function redact(text, env) {
  const secrets = Object.entries(env)
    .filter(
      ([name, value]) =>
        /(SECRET|TOKEN|PASSWORD|PASSWD|WEBHOOK|CREDENTIAL|KEY)/i.test(name) &&
        typeof value === "string" &&
        value.length >= 6,
    )
    .map(([, value]) => value);
  return redactText(text, { secrets, maxOutputLength: Number.MAX_SAFE_INTEGER });
}

export default async function writeCommandLog({
  file,
  name,
  stdout = "",
  stderr = "",
  env = process.env,
}) {
  const safeStdout = redact(stdout, env);
  const safeStderr = redact(stderr, env);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    `Command: ${name}\n\n--- stdout ---\n${safeStdout}\n--- stderr ---\n${safeStderr}\n`,
  );
  return { stdout: safeStdout, stderr: safeStderr };
}
