import writeRedactedCommandOutput from "./output.mjs";

export default async function logCapturedOutput({
  file,
  name,
  stdout = "",
  stderr = "",
  env,
  quiet = false,
  output = process,
}) {
  const safe = await writeRedactedCommandOutput({ file, name, stdout, stderr, env });
  if (!quiet) {
    output.stdout.write(safe.stdout);
    output.stderr.write(safe.stderr);
  }
  return safe;
}
