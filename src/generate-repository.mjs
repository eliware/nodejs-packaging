import { readFile } from "node:fs/promises";
import path from "node:path";
import generateCandidate from "./generate/candidate.mjs";
import parseArguments from "./cli/arguments.mjs";
import { fileURLToPath } from "node:url";

export default async function main(argv = process.argv.slice(2)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const args = parseArguments(argv);
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
  const result = await generateCandidate({
    root,
    version,
    generationId,
    outputRoot,
    rpmPath,
    rpmRecord,
    sourceInput,
    now,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
