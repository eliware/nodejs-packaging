import { spawnSync } from "node:child_process";
import { cp, lstat, mkdir, readFile, readdir, rename, rm, symlink } from "node:fs/promises";
import path from "node:path";
import publishFilesystemModule from "./filesystem.mjs";
import releaseGenerationModule from "./release-generation.mjs";
const files = publishFilesystemModule();
const { prepareReleaseGeneration } = releaseGenerationModule();

async function main(argv = process.argv.slice(2)) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith("--")) args.set(argv[index].slice(2), argv[++index]);
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
  if ((await files.exists(finalRoot)) || (await files.exists(stagingRoot)))
    throw new Error(`generation already exists: ${generationId}`);
  await mkdir(path.dirname(stagingRoot), { recursive: true });
  await cp(candidateRoot, stagingRoot, { recursive: true });

  try {
    const { rpmSha256 } = await prepareReleaseGeneration({
      stagingRoot,
      rpmName: rpms[0],
      generationId,
      keyFingerprint,
      gpgHome,
      run,
      files,
    });

    await rename(stagingRoot, finalRoot);
    const stablePointer = path.join(repositoryRoot, "el10/x86_64/stable");
    await mkdir(path.dirname(stablePointer), { recursive: true });
    if (await files.exists(stablePointer)) {
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
      if (await files.exists(publicPath)) {
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
      await files.atomicCopy(
        path.join(finalRoot, "metadata", name),
        path.join(repositoryRoot, "metadata", name),
      );
    }
    await files.atomicCopy(
      path.join(finalRoot, "metadata/release-manifest.json.asc"),
      path.join(repositoryRoot, "metadata/release-manifest.json.asc"),
    );
    await files.atomicCopy(
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
}

export default function moduleApi() {
  return { main };
}
