import path from "node:path";
import { readFile, readdir } from "node:fs/promises";

export default async function loadReleaseRpmInput(candidateRoot, dependencies = {}) {
  const load = dependencies.readFile || readFile;
  const list = dependencies.readdir || readdir;
  const candidateManifest = JSON.parse(
    await load(path.join(candidateRoot, "metadata/release-manifest.json"), "utf8"),
  );
  const generationId = candidateManifest.generation_id;
  if (!/^node-v26\.[0-9]+\.[0-9]+-el10-x86_64-[0-9]+$/.test(generationId || ""))
    throw new Error("candidate has an invalid generation identifier");
  const sourceRpmDirectory = path.join(candidateRoot, "el10/x86_64/stable");
  const rpms = (await list(sourceRpmDirectory)).filter((name) => name.endsWith(".rpm"));
  if (rpms.length !== 1) throw new Error(`expected one RPM in candidate, found ${rpms.length}`);
  return { generationId, sourceRpmDirectory, rpmName: rpms[0] };
}
