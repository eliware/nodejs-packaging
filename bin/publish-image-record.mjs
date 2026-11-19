#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(
  process.env.NODEJS_REPOSITORY_ROOT || "/eliware/nodejs-repository",
);
const recordPath = path.resolve(process.argv[2] || "");
const keyFingerprint = process.env.NODEJS_SIGNING_KEY;
const gpgHome = path.resolve(
  process.env.NODEJS_GNUPGHOME || "/var/lib/eliware/nodejs-signing/gnupg",
);
if (!process.argv[2]) throw new Error("pass the published image record path");
if (!/^[A-F0-9]{40}$/.test(keyFingerprint || ""))
  throw new Error("set NODEJS_SIGNING_KEY to the signing key fingerprint");

const image = JSON.parse(await readFile(recordPath, "utf8"));
if (image.validation !== "passed" || !/^sha256:[a-f0-9]{64}$/.test(image.digest || ""))
  throw new Error("image record must contain a passed validation and registry digest");
const oldActive = JSON.parse(
  await readFile(path.join(repositoryRoot, "metadata/active-generation.json"), "utf8"),
);
const oldRoot = path.join(repositoryRoot, ".generations", oldActive.generation);
const catalog = JSON.parse(
  await readFile(path.join(repositoryRoot, "metadata/catalog.json"), "utf8"),
);
if (catalog.stable?.latest?.node_version !== image.source_release)
  throw new Error("image release does not match the published stable RPM");

const generated = new Date().toISOString();
const stamp = generated.replace(/[-:.TZ]/g, "");
const generationId = `node-v${image.source_release}-el10-x86_64-${stamp}`;
const stage = path.join(repositoryRoot, ".generations", `.staging-${generationId}`);
const finalRoot = path.join(repositoryRoot, ".generations", generationId);
if ((await exists(finalRoot)) || (await exists(stage)))
  throw new Error(`generation already exists: ${generationId}`);
await mkdir(path.dirname(stage), { recursive: true });
await cp(oldRoot, stage, { recursive: true });

try {
  const catalogPath = path.join(stage, "metadata/catalog.json");
  const stagedCatalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const release = stagedCatalog.stable.latest;
  const provenancePath = `metadata/provenance/images/nodejs26-${image.source_release}.json`;
  const imageRecord = {
    repository: image.repository,
    tag: image.tag,
    digest: image.digest,
    base_image: image.base_image,
    base_image_digest: image.base_image_digest,
    rpm_sha256: image.rpm_sha256,
    validation: "passed",
    provenance_path: provenancePath,
  };
  release.image = imageRecord;
  release.generation_id = generationId;
  release.generated = generated;
  stagedCatalog.stable.items = stagedCatalog.stable.items.map((item) => ({
    ...item,
    image: imageRecord,
    generation_id: generationId,
    generated,
  }));
  stagedCatalog.images = [
    {
      ...imageRecord,
      node_version: image.source_release,
      local_image_id: image.local_image_id,
      generated,
    },
  ];
  stagedCatalog.active_generation = generationId;
  stagedCatalog.generated = generated;
  await writeJson(catalogPath, stagedCatalog);
  await writeJson(path.join(stage, "metadata/releases/nodejs26.json"), release);
  const packageProvenancePath = path.join(stage, "metadata/provenance/package.json");
  const packageProvenance = JSON.parse(await readFile(packageProvenancePath, "utf8"));
  packageProvenance.generation_id = generationId;
  await writeJson(packageProvenancePath, packageProvenance);
  await rm(`${packageProvenancePath}.asc`, { force: true });
  await sign(packageProvenancePath, keyFingerprint, gpgHome);

  const validationPath = path.join(stage, "metadata/validation/image.json");
  await writeJson(validationPath, {
    metadata_version: "0.1.0",
    schema: 1,
    node_version: image.source_release,
    target: "centos-stream-10-x86_64",
    image: image.repository,
    tag: image.tag,
    digest: image.digest,
    base_image: image.base_image,
    base_image_digest: image.base_image_digest,
    smoke_test: "passed",
    registry_push: "passed",
    status: "passed",
    generated,
  });
  const imageProvenancePath = path.join(stage, provenancePath);
  await mkdir(path.dirname(imageProvenancePath), { recursive: true });
  await writeJson(imageProvenancePath, {
    metadata_version: "0.1.0",
    schema: 1,
    generation_id: generationId,
    node_version: image.source_release,
    image: imageRecord,
    local_image_id: image.local_image_id,
    source_sha256: image.source_sha256,
    build: { base_image: image.base_image, base_image_digest: image.base_image_digest },
    validation_path: "metadata/validation/image.json",
    generated,
  });
  await sign(imageProvenancePath, keyFingerprint, gpgHome);
  await writeJson(path.join(stage, "metadata/active-generation.json"), {
    metadata_version: "0.1.0",
    schema: 1,
    generation: generationId,
    generated,
  });
  await writeJson(path.join(stage, "generation.json"), {
    metadata_version: "0.1.0",
    schema: 1,
    generation: generationId,
    generated,
  });

  const manifestPath = path.join(stage, "metadata/release-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.generation_id = generationId;
  manifest.generated = generated;
  manifest.catalog_sha256 = await hashFile(catalogPath);
  manifest.repository_metadata_sha256 = await hashFile(
    path.join(stage, "el10/x86_64/stable/repodata/repomd.xml"),
  );
  manifest.files = await listFiles(
    stage,
    new Set([
      "metadata/release-manifest.json",
      "metadata/release-manifest.json.asc",
      "metadata/repository-index.json",
    ]),
  );
  await writeJson(manifestPath, manifest);
  await sign(manifestPath, keyFingerprint, gpgHome);
  const indexPath = path.join(stage, "metadata/repository-index.json");
  await writeJson(indexPath, {
    metadata_version: "0.1.0",
    schema: 1,
    generated,
    directories: await buildIndex(stage, "/", "metadata/repository-index.json"),
  });

  await rename(stage, finalRoot);
  await replacePointer(
    path.join(repositoryRoot, "el10/x86_64/stable"),
    path.join(finalRoot, "el10/x86_64/stable"),
  );
  const metadataRoot = path.join(repositoryRoot, "metadata");
  for (const name of ["provenance", "releases", "validation"])
    await replacePointer(path.join(metadataRoot, name), path.join(finalRoot, "metadata", name));
  for (const name of [
    "catalog.json",
    "repository-index.json",
    "release-manifest.json",
    "release-manifest.json.asc",
  ])
    await atomicCopy(path.join(finalRoot, "metadata", name), path.join(metadataRoot, name));
  await atomicCopy(
    path.join(finalRoot, "metadata/active-generation.json"),
    path.join(metadataRoot, "active-generation.json"),
  );
  process.stdout.write(
    `${JSON.stringify({ generation: generationId, image: imageRecord }, null, 2)}\n`,
  );
} catch (error) {
  await rm(stage, { recursive: true, force: true });
  throw error;
}

async function exists(file) {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function replacePointer(pointer, target) {
  await mkdir(path.dirname(pointer), { recursive: true });
  if (await exists(pointer)) await rm(pointer, { recursive: true, force: true });
  await symlink(path.relative(path.dirname(pointer), target), pointer);
}
async function atomicCopy(source, destination) {
  const temporary = `${destination}.tmp-${process.pid}`;
  await cp(source, temporary);
  await rename(temporary, destination);
}
async function hashFile(file) {
  const hash = createHash("sha256");
  const { createReadStream } = await import("node:fs");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}
async function sign(file, fingerprint, home) {
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(
    "gpg",
    ["--batch", "--yes", "--local-user", fingerprint, "--armor", "--detach-sign", file],
    { encoding: "utf8", env: { ...process.env, GNUPGHOME: home } },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`gpg exited with status ${result.status}: ${result.stderr}`);
}
async function listFiles(directory, exclude = new Set(), relative = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (exclude.has(name)) continue;
    if (entry.isDirectory()) files.push(...(await listFiles(file, exclude, name)));
    else if (entry.isFile())
      files.push({ path: name, sha256: await hashFile(file), size: (await stat(file)).size });
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}
async function buildIndex(directory, relative = "/", excludedPath = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const items = [];
  const directories = {};
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    const entryPath = relative === "/" ? entry.name : `${relative.slice(1)}${entry.name}`;
    if (entryPath === excludedPath) continue;
    const info = await stat(file);
    const isDirectory = info.isDirectory();
    const item = {
      name: entry.name,
      type: isDirectory ? "directory" : "file",
      size: isDirectory ? null : info.size,
      modified: info.mtime.toISOString(),
      href: `${relative}${encodeURIComponent(entry.name)}${isDirectory ? "/" : ""}`,
    };
    if (!isDirectory) item.sha256 = await hashFile(file);
    items.push(item);
  }
  items.sort((left, right) => left.name.localeCompare(right.name));
  directories[relative] = { path: relative, entries: items, total: items.length };
  for (const item of items.filter((value) => value.type === "directory"))
    Object.assign(
      directories,
      await buildIndex(
        path.join(directory, item.name),
        `${relative}${encodeURIComponent(item.name)}/`,
        excludedPath,
      ),
    );
  return directories;
}
