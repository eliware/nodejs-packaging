export default function parseRpmPackageInfo(output, expectedVersion) {
  const fields = output.trim().split("\n");
  const [name, epochValue, version, release, architecture] = fields;
  if (name !== "eliware-node26" || version !== expectedVersion || architecture !== "x86_64")
    throw new Error(`built RPM metadata does not match target: ${fields.join(" ")}`);
  return {
    name,
    epoch: epochValue === "(none)" ? null : Number(epochValue),
    version,
    release,
    architecture,
  };
}
