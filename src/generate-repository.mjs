import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import generateFilesModule from "./generate/files.mjs";
import generateIndexModule from "./generate/index.mjs";
import generateRecordsModule from "./generate/records.mjs";
const { exists, hashFile, listFiles } = generateFilesModule();
const { buildIndex } = generateIndexModule();
const { writeReleaseRecords } = generateRecordsModule();
import { fileURLToPath } from "node:url";

async function main(argv = process.argv.slice(2)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith("--")) args.set(argv[index].slice(2), argv[++index]);
  }
  const version = args.get("version");
  if (!/^26\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version || ""))
    throw new Error("pass a stable Node.js 26 version with --version");

  const packageDir = path.resolve(
    args.get("rpm-dir") || path.join(root, "artifacts/rpms", version),
  );
  const rpmRecord = JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf8"));
  const sourceInput = JSON.parse(
    await readFile(path.join(root, ".state/sources", version, "release-input.json"), "utf8"),
  );
  if (rpmRecord.name !== "eliware-node26" || rpmRecord.version !== version)
    throw new Error("RPM record does not match the requested Node.js version");
  const rpmPath = path.join(packageDir, rpmRecord.path);

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:.TZ]/g, "");
  const generationId = `node-v${version}-el10-x86_64-${timestamp}`;
  const outputRoot = path.resolve(
    args.get("output") || path.join(root, "artifacts/repositories", generationId),
  );
  if (await exists(outputRoot)) throw new Error(`candidate output already exists: ${outputRoot}`);
  await mkdir(path.dirname(outputRoot), { recursive: true });
  const stage = await mkdtemp(path.join(path.dirname(outputRoot), ".nodejs26-repository-"));
  const candidate = path.join(stage, "generation");
  const rpmRelativePath = `el10/x86_64/stable/${rpmRecord.path}`;
  const rpmTarget = path.join(candidate, rpmRelativePath);
  await mkdir(path.dirname(rpmTarget), { recursive: true });
  await cp(rpmPath, rpmTarget);
  await cp(path.join(root, "templates/nodejs26.repo"), path.join(candidate, "nodejs26.repo"));
  const rpmInfo = await stat(rpmTarget);
  const rpmSha256 = await hashFile(rpmTarget);
  const rpmRecordUpdated = {
    ...rpmRecord,
    path: rpmRelativePath,
    sha256: rpmSha256,
    size: rpmInfo.size,
  };

  try {
    const repo = spawnSync("createrepo_c", ["--checksum", "sha256", path.dirname(rpmTarget)], {
      encoding: "utf8",
    });
    if (repo.error) throw repo.error;
    if (repo.status !== 0)
      throw new Error(`createrepo_c exited with status ${repo.status}: ${repo.stderr}`);

    await writeReleaseRecords({
      candidate,
      root,
      version,
      generationId,
      rpmRecordUpdated,
      sourceInput,
      now,
    });

    const sums = `${rpmSha256}  ${rpmRecord.path}\n`;
    await writeFile(path.join(path.dirname(rpmTarget), "SHA256SUMS"), sums);
    const files = await listFiles(candidate);
    const manifest = {
      metadata_version: "0.1.0",
      schema: 1,
      generation_id: generationId,
      generated: now.toISOString(),
      signed: false,
      publication_ready: false,
      catalog_sha256: await hashFile(path.join(candidate, "metadata/catalog.json")),
      repository_metadata_sha256: await hashFile(
        path.join(path.dirname(rpmTarget), "repodata/repomd.xml"),
      ),
      files,
    };
    await writeFile(
      path.join(candidate, "metadata/release-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    const index = {
      metadata_version: "0.1.0",
      schema: 1,
      generated: now.toISOString(),
      directories: await buildIndex(candidate),
    };
    await writeFile(
      path.join(candidate, "metadata/repository-index.json"),
      `${JSON.stringify(index, null, 2)}\n`,
    );
    await rename(candidate, outputRoot);
    process.stdout.write(
      `${JSON.stringify({ output: outputRoot, generation_id: generationId, rpm: rpmRecordUpdated }, null, 2)}\n`,
    );
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

export default function moduleApi() {
  return { main };
}
