import { readFile } from "node:fs/promises";
import path from "node:path";
import generateFilesModule from "../generate/files.mjs";
import parseArguments from "../cli/arguments.mjs";

const { hashFile: defaultHashFile } = generateFilesModule();

export default async function loadRpmInput(argv, dependencies = {}) {
  const args = parseArguments(argv);
  const releaseInputArgument = args.get("release-input");
  const versionArgument = args.get("version");
  if (!releaseInputArgument && !versionArgument)
    throw new Error("pass --version VERSION or --release-input PATH");
  const root = dependencies.root || process.cwd();
  const releaseInput = path.resolve(
    releaseInputArgument ||
      path.join(root, ".state/sources", versionArgument, "release-input.json"),
  );
  const read = dependencies.readFile || readFile;
  const input = JSON.parse(await read(releaseInput, "utf8"));
  const version = input.node_version;
  if (!/^26\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version || ""))
    throw new Error("release input must name a stable Node.js 26 version");
  if (input.target?.architecture !== "x86_64" || input.target?.version !== "10")
    throw new Error("release input does not target CentOS Stream 10 x86_64");

  const osRelease = dependencies.osRelease || (await read("/etc/os-release", "utf8"));
  if (!/^ID="?centos"?$/m.test(osRelease) || !/^VERSION_ID="?10/m.test(osRelease))
    throw new Error("run RPM packaging on a CentOS Stream 10 host");
  if ((dependencies.architecture || process.arch) !== "x64")
    throw new Error("run RPM packaging on an x86_64 host");

  const archive = path.join(path.dirname(releaseInput), input.source.file);
  const hashFile = dependencies.hashFile || defaultHashFile;
  if ((await hashFile(archive)) !== input.source.sha256)
    throw new Error(`prepared archive checksum does not match release input: ${archive}`);
  if (!input.npm || !/^(1[2-9]|[2-9][0-9]+)\.\d+\.\d+$/.test(input.npm.version || ""))
    throw new Error("release input must include a verified npm package archive");
  const npmArchive = path.join(path.dirname(releaseInput), input.npm.file);
  const npmIntegrity = `sha512-${await hashFile(npmArchive, "sha512", "base64")}`;
  if (npmIntegrity !== input.npm.integrity)
    throw new Error(`prepared npm archive integrity does not match release input: ${npmArchive}`);
  return { args, releaseInput, input, version, archive, npmArchive };
}
