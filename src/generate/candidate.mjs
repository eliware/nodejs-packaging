import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import generateFilesModule from "./files.mjs";
import writeRepositoryIndex from "./write-index.mjs";
import writeReleaseRecords from "./records.mjs";

const { exists, hashFile, listFiles } = generateFilesModule();
export default async function generateCandidate({
  root,
  version,
  generationId,
  outputRoot,
  rpmPath,
  rpmRecord,
  sourceInput,
  now,
}) {
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
    const rpmDirectory = path.dirname(rpmTarget);
    const repository = spawnSync("createrepo_c", ["--checksum", "sha256", rpmDirectory], {
      encoding: "utf8",
    });
    if (repository.error) throw repository.error;
    if (repository.status !== 0)
      throw new Error(`createrepo_c exited with status ${repository.status}: ${repository.stderr}`);

    await writeReleaseRecords({
      candidate,
      root,
      version,
      generationId,
      rpmRecordUpdated,
      sourceInput,
      now,
    });
    await writeFile(path.join(rpmDirectory, "SHA256SUMS"), `${rpmSha256}  ${rpmRecord.path}\n`);
    const manifest = {
      metadata_version: "0.1.0",
      schema: 1,
      generation_id: generationId,
      generated: now.toISOString(),
      signed: false,
      publication_ready: false,
      catalog_sha256: await hashFile(path.join(candidate, "metadata/catalog.json")),
      repository_metadata_sha256: await hashFile(path.join(rpmDirectory, "repodata/repomd.xml")),
      files: await listFiles(candidate),
    };
    await writeFile(
      path.join(candidate, "metadata/release-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    await writeRepositoryIndex({ directory: candidate, generated: now.toISOString() });
    await rename(candidate, outputRoot);
    return { output: outputRoot, generation_id: generationId, rpm: rpmRecordUpdated };
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
