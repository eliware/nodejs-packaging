import redactCommandOutput from "./redact.mjs";

export default function redactCommandOutputStreams({
  stdout = "",
  stderr = "",
  env = process.env,
}) {
  const safe = {
    stdout: redactCommandOutput(stdout, env),
    stderr: redactCommandOutput(stderr, env),
  };
  return safe;
}
