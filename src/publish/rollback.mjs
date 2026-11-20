import { spawnSync } from "node:child_process";
import path from "node:path";
import { readFile } from "node:fs/promises";
import filesystemModule from "./filesystem.mjs";
import activateGeneration from "./activate-generation.mjs";

const files = filesystemModule();
export default async function rollbackGeneration(repositoryRoot, generation, dependencies = {}) {
  if (!/^node-v26\.[0-9]+\.[0-9]+-el10-x86_64-[0-9]+$/.test(generation || ""))
    throw new Error("pass a retained stable generation identifier");
  const root = path.join(repositoryRoot, ".generations", generation);
  const manifest = path.join(root, "metadata/release-manifest.json");
  const signature = `${manifest}.asc`;
  const active = JSON.parse(
    await readFile(path.join(root, "metadata/active-generation.json"), "utf8"),
  );
  if (active.generation !== generation)
    throw new Error("generation metadata does not match its directory");
  const verify = dependencies.verify || ((args) => spawnSync("gpg", args, { encoding: "utf8" }));
  const result = verify(["--verify", signature, manifest]);
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `generation signature verification failed: ${result.stderr || "unknown error"}`,
    );
  await (dependencies.activate || activateGeneration)({
    repositoryRoot,
    generationRoot: root,
    files: dependencies.files || files,
    rootFiles: [
      { source: "keys/RPM-GPG-KEY-ELIWARE-NODEJS", destination: "keys/RPM-GPG-KEY-ELIWARE-NODEJS" },
      { source: "nodejs26.repo", destination: "nodejs26.repo" },
    ],
  });
  return generation;
}
