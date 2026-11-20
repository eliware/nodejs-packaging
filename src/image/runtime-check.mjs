export default function verifyImageRuntime({ runDocker, image, version, npmVersion }) {
  const node = runDocker(
    ["run", "--rm", "--entrypoint", "node", image, "--version"],
    { encoding: "utf8" },
    false,
  );
  if (node.status !== 0 || node.stdout.trim() !== `v${version}`)
    throw new Error(`image runtime check failed: ${node.stderr || node.stdout}`);
  for (const command of ["npm", "npx"]) {
    const check = runDocker(
      ["run", "--rm", "--entrypoint", command, image, "--version"],
      { encoding: "utf8" },
      false,
    );
    if (check.status !== 0 || check.stdout.trim() !== npmVersion)
      throw new Error(`${command} runtime check failed: ${check.stderr || check.stdout}`);
  }
}
