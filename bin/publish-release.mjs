#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
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
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  if (process.argv[index].startsWith("--"))
    args.set(process.argv[index].slice(2), process.argv[++index]);
}
const version = args.get("version");
const candidateRoot = path.resolve(args.get("candidate") || "");
const repositoryRoot = path.resolve(
  args.get("repository") || process.env.NODEJS_REPOSITORY_ROOT || "/eliware/nodejs-repository",
);
const keyFingerprint = process.env.NODEJS_SIGNING_KEY;
const gpgHome = path.resolve(
  process.env.NODEJS_GNUPGHOME || "/var/lib/eliware/nodejs-signing/gnupg",
);
if (!/^26\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version || ""))
  throw new Error("pass a stable Node.js 26 version with --version");
if (!candidateRoot || !args.get("candidate"))
  throw new Error("pass a repository candidate with --candidate");
if (!/^[A-F0-9]{40}$/.test(keyFingerprint || ""))
  throw new Error("set NODEJS_SIGNING_KEY to the signing key fingerprint");

const candidateManifest = JSON.parse(
  await readFile(path.join(candidateRoot, "metadata/release-manifest.json"), "utf8"),
);
const generationId = candidateManifest.generation_id;
if (!/^node-v26\.[0-9]+\.[0-9]+-el10-x86_64-[0-9]+$/.test(generationId || ""))
  throw new Error("candidate has an invalid generation identifier");
const sourceRpmDirectory = path.join(candidateRoot, "el10/x86_64/stable");
const rpms = (await readdir(sourceRpmDirectory)).filter((name) => name.endsWith(".rpm"));
if (rpms.length !== 1) throw new Error(`expected one RPM in candidate, found ${rpms.length}`);
const stagingRoot = path.join(repositoryRoot, ".generations", `.staging-${generationId}`);
const finalRoot = path.join(repositoryRoot, ".generations", generationId);
if ((await exists(finalRoot)) || (await exists(stagingRoot)))
  throw new Error(`generation already exists: ${generationId}`);
await mkdir(path.dirname(stagingRoot), { recursive: true });
await cp(candidateRoot, stagingRoot, { recursive: true });

try {
  const rpmPath = path.join(stagingRoot, "el10/x86_64/stable", rpms[0]);
  run("rpmsign", ["--addsign", "--define", `_gpg_name ${keyFingerprint}`, rpmPath], {
    GNUPGHOME: gpgHome,
  });
  const rpmSha256 = await hashFile(rpmPath);
  const releasePath = path.join(stagingRoot, "metadata/releases/nodejs26.json");
  const release = JSON.parse(await readFile(releasePath, "utf8"));
  release.package.sha256 = rpmSha256;
  release.package.size = (await stat(rpmPath)).size;
  await writeJson(releasePath, release);
  const provenancePath = path.join(stagingRoot, "metadata/provenance/package.json");
  const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
  provenance.package.sha256 = rpmSha256;
  provenance.package.size = release.package.size;
  await writeJson(provenancePath, provenance);

  const stablePath = path.join(stagingRoot, "el10/x86_64/stable");
  await rm(path.join(stablePath, "repodata"), { recursive: true, force: true });
  run("createrepo_c", ["--checksum", "sha256", stablePath]);
  const publicKeyPath = path.join(stagingRoot, "keys/RPM-GPG-KEY-ELIWARE-NODEJS");
  await mkdir(path.dirname(publicKeyPath), { recursive: true });
  const publicKey = run("gpg", ["--batch", "--armor", "--export", keyFingerprint], {
    GNUPGHOME: gpgHome,
    capture: true,
  });
  await writeFile(publicKeyPath, publicKey.stdout);
  await sign(path.join(stablePath, "repodata/repomd.xml"), keyFingerprint, gpgHome);
  await sign(provenancePath, keyFingerprint, gpgHome);

  const catalogPath = path.join(stagingRoot, "metadata/catalog.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  catalog.stable.latest.package.sha256 = rpmSha256;
  catalog.stable.latest.package.size = release.package.size;
  catalog.stable.items = catalog.stable.items.map((item) => ({
    ...item,
    package: { ...item.package, sha256: rpmSha256, size: release.package.size },
  }));
  await writeJson(catalogPath, catalog);
  const active = {
    metadata_version: "0.1.0",
    schema: 1,
    generation: generationId,
    generated: new Date().toISOString(),
  };
  await writeJson(path.join(stagingRoot, "metadata/active-generation.json"), active);
  await writeJson(path.join(stagingRoot, "generation.json"), {
    metadata_version: "0.1.0",
    schema: 1,
    generation: generationId,
    generated: active.generated,
  });
  const manifestPath = path.join(stagingRoot, "metadata/release-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.signed = true;
  manifest.publication_ready = true;
  manifest.catalog_sha256 = await hashFile(catalogPath);
  manifest.repository_metadata_sha256 = await hashFile(
    path.join(stablePath, "repodata/repomd.xml"),
  );
  manifest.files = await listFiles(
    stagingRoot,
    new Set([
      "metadata/release-manifest.json",
      "metadata/release-manifest.json.asc",
      "metadata/repository-index.json",
    ]),
  );
  await writeJson(manifestPath, manifest);
  await sign(manifestPath, keyFingerprint, gpgHome);
  await writeJson(path.join(stagingRoot, "metadata/repository-index.json"), {
    metadata_version: "0.1.0",
    schema: 1,
    generated: active.generated,
    directories: await buildIndex(stagingRoot, "/", "metadata/repository-index.json"),
  });

  await rename(stagingRoot, finalRoot);
  const stablePointer = path.join(repositoryRoot, "el10/x86_64/stable");
  await mkdir(path.dirname(stablePointer), { recursive: true });
  if (await exists(stablePointer)) {
    const info = await lstat(stablePointer);
    if (info.isDirectory() && (await readdir(stablePointer)).length)
      throw new Error("stable repository path is not empty");
    await rm(stablePointer, { recursive: true, force: true });
  }
  await symlink(
    path.relative(path.dirname(stablePointer), path.join(finalRoot, "el10/x86_64/stable")),
    stablePointer,
  );
  await mkdir(path.join(repositoryRoot, "keys"), { recursive: true });
  await cp(
    path.join(finalRoot, "keys/RPM-GPG-KEY-ELIWARE-NODEJS"),
    path.join(repositoryRoot, "keys/RPM-GPG-KEY-ELIWARE-NODEJS"),
  );
  await cp(path.join(finalRoot, "nodejs26.repo"), path.join(repositoryRoot, "nodejs26.repo"));
  const publicMetadataRoot = path.join(repositoryRoot, "metadata");
  for (const name of ["provenance", "releases", "validation"]) {
    const publicPath = path.join(publicMetadataRoot, name);
    if (await exists(publicPath)) {
      const info = await lstat(publicPath);
      if (info.isDirectory() && (await readdir(publicPath)).length)
        throw new Error(`metadata path is not empty: ${publicPath}`);
      await rm(publicPath, { recursive: true, force: true });
    }
    await symlink(
      path.relative(publicMetadataRoot, path.join(finalRoot, "metadata", name)),
      publicPath,
    );
  }
  for (const name of ["catalog.json", "repository-index.json", "release-manifest.json"]) {
    await atomicCopy(
      path.join(finalRoot, "metadata", name),
      path.join(repositoryRoot, "metadata", name),
    );
  }
  await atomicCopy(
    path.join(finalRoot, "metadata/release-manifest.json.asc"),
    path.join(repositoryRoot, "metadata/release-manifest.json.asc"),
  );
  await atomicCopy(
    path.join(finalRoot, "metadata/active-generation.json"),
    path.join(repositoryRoot, "metadata/active-generation.json"),
  );
  process.stdout.write(
    `${JSON.stringify({ generation: generationId, repository: repositoryRoot, rpm_sha256: rpmSha256, signing_key: keyFingerprint }, null, 2)}\n`,
  );
} catch (error) {
  await rm(stagingRoot, { recursive: true, force: true });
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
function run(command, commandArgs, extraEnv = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} exited with status ${result.status}: ${result.stderr}`);
  return result;
}
async function sign(file, fingerprint, home) {
  run("gpg", ["--batch", "--yes", "--local-user", fingerprint, "--armor", "--detach-sign", file], {
    GNUPGHOME: home,
  });
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
async function atomicCopy(source, destination) {
  const temporary = `${destination}.tmp-${process.pid}`;
  await cp(source, temporary);
  await rename(temporary, destination);
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
