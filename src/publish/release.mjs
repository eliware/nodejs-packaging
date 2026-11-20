import { cp, mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import publishFilesystemModule from "./filesystem.mjs";
import loadReleaseInput from "./release/input.mjs";
import prepareReleaseGeneration from "./release/generation.mjs";
import activateGeneration from "./activate-generation.mjs";
import pruneGenerations from "./retention.mjs";
import runRepositoryTool from "./repository-tools.mjs";
import copyReleaseLogs from "./release/logs.mjs";
import assertSafeRepositoryPaths from "./release/paths.mjs";
const files = publishFilesystemModule();
export default async function main(argv = process.argv.slice(2)) {
  const { candidateRoot, repositoryRoot, keyFingerprint, gpgHome } = loadReleaseInput(argv);

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
  await copyReleaseLogs(stagingRoot);

  let activated = false;
  const repositoryToolOutput = [];
  try {
    const { rpmSha256 } = await prepareReleaseGeneration({
      stagingRoot,
      rpmName: rpms[0],
      generationId,
      keyFingerprint,
      gpgHome,
      run: (command, args, extraEnv = {}) =>
        runRepositoryTool({
          command,
          args,
          extraEnv,
          stagingRoot,
          output: repositoryToolOutput,
        }),
      files,
    });

    await assertSafeRepositoryPaths(repositoryRoot);
    await rename(stagingRoot, finalRoot);
    await activateGeneration({
      repositoryRoot,
      generationRoot: finalRoot,
      files,
      rootFiles: [
        {
          source: "keys/RPM-GPG-KEY-ELIWARE-NODEJS",
          destination: "keys/RPM-GPG-KEY-ELIWARE-NODEJS",
        },
        { source: "nodejs26.repo", destination: "nodejs26.repo" },
      ],
    });
    activated = true;
    await pruneGenerations(repositoryRoot, generationId);
    process.stdout.write(
      `${JSON.stringify({ generation: generationId, repository: repositoryRoot, rpm_sha256: rpmSha256, signing_key: keyFingerprint }, null, 2)}\n`,
    );
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    if (!activated) await rm(finalRoot, { recursive: true, force: true });
    throw error;
  }
}
