import { stat, writeFile } from "node:fs/promises";
import path from "node:path";
import generateFilesModule from "../generate/files.mjs";

const { hashFile: defaultHashFile } = generateFilesModule();

export default async function writePackageRecord({
  rpmFile,
  outputDir,
  packageInfo,
  npmVersion,
  dependencies = {},
}) {
  const info = await (dependencies.stat || stat)(rpmFile);
  const record = {
    name: packageInfo.name,
    epoch: packageInfo.epoch,
    version: packageInfo.version,
    release: packageInfo.release,
    architecture: packageInfo.architecture,
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
