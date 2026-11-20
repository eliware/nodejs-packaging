import redactCommandOutput from "./redact.mjs";
import writeCommandLog from "./log.mjs";

export default async function logCommandOutput({
  file,
  name,
  stdout = "",
  stderr = "",
  env = process.env,
}) {
  const safe = {
    stdout: redactCommandOutput(stdout, env),
    stderr: redactCommandOutput(stderr, env),
  };
  await writeCommandLog({ file, name, ...safe });
  return safe;
}
