import parseArguments from "../cli/arguments.mjs";

export default function loadPrepareArguments(argv, selected) {
  const args = parseArguments(argv);
  const version = args.get("version") || selected.node_version;
  if (!/^26\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))
    throw new Error(`unsupported Node.js 26 version: ${version}`);
  const allowOlder = args.get("allow-older") === "true";
  if (version !== selected.node_version && !allowOlder)
    throw new Error(
      `version ${version} is not the latest stable Node.js 26 release ${selected.node_version}`,
    );
  return { version, allowOlder, npmVersion: args.get("npm-version") || "latest" };
}
