export default function collectProcessOutput(child, onStdout, onStderr) {
  const output = { stdout: "", stderr: "" };
  if (child.stdout)
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      output.stdout += chunk;
      onStdout?.(chunk);
    });
  if (child.stderr)
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      output.stderr += chunk;
      onStderr?.(chunk);
    });
  return output;
}
