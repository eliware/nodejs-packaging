import { stat, writeFile } from "node:fs/promises";
import path from "node:path";
import generateFilesModule from "../generate/files.mjs";

const { hashFile: defaultHashFile } = generateFilesModule();

export default async function writePackageRecord({
  rpmFile,
  outputDir,
  packageInfo,
  version,
  npmVersion,
  dependencies = {},
}) {
  if (
    packageInfo[0] !== "eliware-node26" ||
    packageInfo[2] !== version ||
    packageInfo[4] !== "x86_64"
  )
    throw new Error(`built RPM metadata does not match target: ${packageInfo.join(" ")}`);
  const info = await (dependencies.stat || stat)(rpmFile);
  const record = {
    name: packageInfo[0],
    epoch: packageInfo[1] === "(none)" ? null : Number(packageInfo[1]),
    version: packageInfo[2],
    release: packageInfo[3],
    architecture: packageInfo[4],
    npm_version: npmVersion,
    path: path.basename(rpmFile),
    sha256: await (dependencies.hashFile || defaultHashFile)(rpmFile),
    size: info.size,
  };
  await (dependencies.writeFile || writeFile)(
    path.join(outputDir, "package.json"),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  (dependencies.stdout || process.stdout).write(`${JSON.stringify(record, null, 2)}\n`);
  return record;
}
