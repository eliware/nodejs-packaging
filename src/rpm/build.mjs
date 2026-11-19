import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import rpmReleaseForNpm from "../rpm-release.mjs";
import generateFilesModule from "../generate/files.mjs";

const { hashFile, listFiles } = generateFilesModule();

async function main(argv = process.argv.slice(2)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith("--")) args.set(argv[index].slice(2), argv[++index]);
  }

  const releaseInputArgument = args.get("release-input");
  const versionArgument = args.get("version");
  if (!releaseInputArgument && !versionArgument)
    throw new Error("pass --version VERSION or --release-input PATH");
  const releaseInput = path.resolve(
    releaseInputArgument ||
      path.join(root, ".state/sources", versionArgument, "release-input.json"),
  );
  const input = JSON.parse(await readFile(releaseInput, "utf8"));
  const version = input.node_version;
  if (!/^26\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version || ""))
    throw new Error("release input must name a stable Node.js 26 version");
  if (input.target?.architecture !== "x86_64" || input.target?.version !== "10")
    throw new Error("release input does not target CentOS Stream 10 x86_64");

  const osRelease = await readFile("/etc/os-release", "utf8");
  if (!/^ID="?centos"?$/m.test(osRelease) || !/^VERSION_ID="?10/m.test(osRelease))
    throw new Error("run RPM packaging on a CentOS Stream 10 host");
  if (process.arch !== "x64") throw new Error("run RPM packaging on an x86_64 host");

  const archive = path.join(path.dirname(releaseInput), input.source.file);
  const archiveHash = await hashFile(archive);
  if (archiveHash !== input.source.sha256)
    throw new Error(`prepared archive checksum does not match release input: ${archive}`);
  if (!input.npm || !/^(1[2-9]|[2-9][0-9]+)\.\d+\.\d+$/.test(input.npm.version || ""))
    throw new Error("release input must include a verified npm package archive");
  const npmArchive = path.join(path.dirname(releaseInput), input.npm.file);
  const npmIntegrity = `sha512-${await hashFile(npmArchive, "sha512", "base64")}`;
  if (npmIntegrity !== input.npm.integrity)
    throw new Error(`prepared npm archive integrity does not match release input: ${npmArchive}`);

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "nodejs26-rpmbuild-"));
  const topdir = path.join(temporaryRoot, "rpmbuild");
  for (const directory of ["BUILD", "BUILDROOT", "RPMS", "SOURCES", "SPECS", "SRPMS"])
    await mkdir(path.join(topdir, directory), { recursive: true });
  await cp(archive, path.join(topdir, "SOURCES", input.source.file));
  await cp(npmArchive, path.join(topdir, "SOURCES", input.npm.file));
  await cp(path.join(root, "packaging/nodejs26.spec"), path.join(topdir, "SPECS/nodejs26.spec"));

  try {
    execFileSync("rpmbuild", ["--version"], { stdio: "ignore" });
    execFileSync("rpm", ["--version"], { stdio: "ignore" });
    const build = spawnSync(
      "rpmbuild",
      [
        "-bb",
        "--define",
        `_topdir ${topdir}`,
        "--define",
        `_rpmdir ${path.join(topdir, "RPMS")}`,
        "--define",
        `node_version ${version}`,
        "--define",
        `npm_version ${input.npm.version}`,
        "--define",
        `npm_release ${rpmReleaseForNpm(input.npm.version)}`,
        path.join(topdir, "SPECS/nodejs26.spec"),
      ],
      { encoding: "utf8", stdio: "inherit" },
    );
    if (build.error) throw build.error;
    if (build.status !== 0) throw new Error(`rpmbuild exited with status ${build.status}`);

    const outputDir = path.resolve(
      args.get("output") || path.join(root, "artifacts/rpms", version),
    );
    await mkdir(outputDir, { recursive: true });
    const rpmFiles = (await listFiles(path.join(topdir, "RPMS")))
      .map(({ path: relative }) => path.join(topdir, "RPMS", relative))
      .filter((file) => file.endsWith(".rpm"));
    if (rpmFiles.length !== 1) throw new Error(`expected one RPM, found ${rpmFiles.length}`);
    const rpmFile = path.join(outputDir, path.basename(rpmFiles[0]));
    await cp(rpmFiles[0], rpmFile);
    const packageInfo = execFileSync(
      "rpm",
      ["-qp", "--queryformat", "%{NAME}\n%{EPOCH}\n%{VERSION}\n%{RELEASE}\n%{ARCH}\n", rpmFile],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n");
    if (
      packageInfo[0] !== "eliware-node26" ||
      packageInfo[2] !== version ||
      packageInfo[4] !== "x86_64"
    )
      throw new Error(`built RPM metadata does not match target: ${packageInfo.join(" ")}`);

    const info = await stat(rpmFile);
    const record = {
      name: packageInfo[0],
      epoch: packageInfo[1] === "(none)" ? null : Number(packageInfo[1]),
      version: packageInfo[2],
      release: packageInfo[3],
      architecture: packageInfo[4],
      npm_version: input.npm.version,
      path: path.basename(rpmFile),
      sha256: await hashFile(rpmFile),
      size: info.size,
    };
    await writeFile(path.join(outputDir, "package.json"), `${JSON.stringify(record, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export default function moduleApi() {
  return { main };
}
