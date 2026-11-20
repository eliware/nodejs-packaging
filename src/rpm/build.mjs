import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import rpmReleaseForNpm from "../rpm-release.mjs";
import generateFilesModule from "../generate/files.mjs";
import loadRpmInput from "./input.mjs";

const { hashFile, listFiles } = generateFilesModule();

export default async function main(argv = process.argv.slice(2)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const { args, input, version, archive, npmArchive } = await loadRpmInput(argv, { root });

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
