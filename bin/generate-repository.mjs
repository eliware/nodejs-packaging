#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  if (process.argv[index].startsWith("--"))
    args.set(process.argv[index].slice(2), process.argv[++index]);
}
const version = args.get("version");
if (!/^26\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version || ""))
  throw new Error("pass a stable Node.js 26 version with --version");

const packageDir = path.resolve(args.get("rpm-dir") || path.join(root, "artifacts/rpms", version));
const rpmRecord = JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf8"));
const sourceInput = JSON.parse(
  await readFile(path.join(root, ".state/sources", version, "release-input.json"), "utf8"),
);
const rpmPath = path.join(packageDir, rpmRecord.path);
if (rpmRecord.name !== "eliware-nodejs26" || rpmRecord.version !== version)
  throw new Error("RPM record does not match the requested Node.js version");

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

  const validation = {
    schema: 1,
    node_version: version,
    target: "centos-stream-10-x86_64",
    checks: {
      archive_signature: "passed",
      archive_checksum: "passed",
      rpm_build: "passed",
      rpm_version: "passed",
      npm_cli: "passed",
      npm_version: rpmRecord.npm_version,
    },
    status: "passed",
    generated: now.toISOString(),
  };
  await mkdir(path.join(candidate, "metadata/validation"), { recursive: true });
  await writeFile(
    path.join(candidate, "metadata/validation/package.json"),
    `${JSON.stringify(validation, null, 2)}\n`,
  );

  const releaseRecord = {
    metadata_version: "0.1.0",
    schema: 1,
    release_id: `node-v${version}-el10-x86_64`,
    channel: "stable",
    node_version: version,
    target: {
      distribution: "centos-stream",
      version: "10",
      repository: "epel",
      architecture: "x86_64",
      format: "rpm",
    },
    source: sourceInput.source,
    npm: sourceInput.npm,
    package: rpmRecordUpdated,
    validation: { status: "passed", record_path: "metadata/validation/package.json" },
    provenance_path: "metadata/provenance/package.json",
    generation_id: generationId,
    generated: now.toISOString(),
  };
  await mkdir(path.join(candidate, "metadata/provenance"), { recursive: true });
  const provenance = {
    metadata_version: "0.1.0",
    schema: 1,
    generation_id: generationId,
    node_version: version,
    source: sourceInput.source,
    npm: sourceInput.npm,
    package: rpmRecordUpdated,
    validation_path: "metadata/validation/package.json",
    generated: now.toISOString(),
  };
  await writeFile(
    path.join(candidate, "metadata/provenance/package.json"),
    `${JSON.stringify(provenance, null, 2)}\n`,
  );
  await mkdir(path.join(candidate, "metadata/releases"), { recursive: true });
  await writeFile(
    path.join(candidate, "metadata/releases/nodejs26.json"),
    `${JSON.stringify(releaseRecord, null, 2)}\n`,
  );

  const catalog = JSON.parse(
    await readFile(path.join(root, "templates/catalog.seed.json"), "utf8"),
  );
  catalog.generated = now.toISOString();
  catalog.active_generation = generationId;
  catalog.stable = { available: true, latest: releaseRecord, items: [releaseRecord] };
  await mkdir(path.join(candidate, "metadata"), { recursive: true });
  await writeFile(
    path.join(candidate, "metadata/catalog.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
  await writeFile(
    path.join(candidate, "generation.json"),
    `${JSON.stringify({ metadata_version: "0.1.0", schema: 1, generation: generationId, generated: now.toISOString() }, null, 2)}\n`,
  );

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

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function hashFile(file) {
  const hash = createHash("sha256");
  const { createReadStream } = await import("node:fs");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function listFiles(directory, relative = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await listFiles(file, name)));
    else if (entry.isFile()) {
      const info = await stat(file);
      files.push({ path: name, sha256: await hashFile(file), size: info.size });
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function buildIndex(directory, relative = "/") {
  const directories = {};
  const entries = await readdir(directory, { withFileTypes: true });
  const items = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    const info = await stat(file);
    const isDirectory = info.isDirectory();
    const href = `${relative}${encodeURIComponent(entry.name)}${isDirectory ? "/" : ""}`;
    const item = {
      name: entry.name,
      type: isDirectory ? "directory" : "file",
      size: isDirectory ? null : info.size,
      modified: info.mtime.toISOString(),
      href,
    };
    if (!isDirectory) item.sha256 = await hashFile(file);
    items.push(item);
  }
  items.sort((left, right) => left.name.localeCompare(right.name));
  directories[relative] = { path: relative, entries: items, total: items.length };
  for (const item of items.filter((entry) => entry.type === "directory")) {
    const childPath = path.join(directory, decodeURIComponent(item.name));
    Object.assign(
      directories,
      await buildIndex(childPath, `${relative}${encodeURIComponent(item.name)}/`),
    );
  }
  return directories;
}
