import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import loadPublishedRelease from "../repository/catalog.mjs";
import runDocker from "./docker.mjs";
import getBaseImageDigest from "./base-image.mjs";
import buildImage from "./build-image.mjs";
import publishImage from "./publication.mjs";
import verifyImageRuntime from "./runtime-check.mjs";
import parseArguments from "../cli/arguments.mjs";
import resolveRepositoryUrl from "./repository-url.mjs";
export default async function main(argv = process.argv.slice(2)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const args = parseArguments(argv, ["push"]);
  const version = args.get("version");
  const pushImage = args.has("push");
  if (!/^26\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version || ""))
    throw new Error("pass a stable Node.js 26 version with --version");

  const { repositoryBase, publishedRelease } = await loadPublishedRelease(
    version,
    resolveRepositoryUrl(),
    fetch,
  );

  const sourceInput = JSON.parse(
    await readFile(path.join(root, ".state/sources", version, "release-input.json"), "utf8"),
  );
  const target = JSON.parse(await readFile(path.join(root, "build-config/target.json"), "utf8"));
  const image = `${target.image}:${version}`;
  const baseImage = "quay.io/centos/centos:stream10";
  const baseDigest = await getBaseImageDigest({
    baseImage,
    runCommand: async (_command, args) => runDocker(args, { stdio: "inherit" }),
    runCommandCapture: async (_command, args) => runDocker(args, { encoding: "utf8" }),
  });
  const expectedBaseDigest = args.get("base-digest");
  if (expectedBaseDigest && baseDigest !== expectedBaseDigest)
    throw new Error(
      `CentOS base image changed during the conductor run: expected ${expectedBaseDigest}, found ${baseDigest}`,
    );
  const context = await mkdtemp(path.join(os.tmpdir(), "centos10-node26-image-"));
  try {
    buildImage({
      runDocker,
      root,
      version,
      sourceInput,
      repositoryBase,
      generationId: publishedRelease.generation_id,
      image,
      baseDigest,
      context,
    });

    verifyImageRuntime({
      runDocker,
      image,
      version,
      npmVersion: publishedRelease.npm.version,
    });

    await publishImage({
      image,
      target,
      pushImage,
      version,
      root,
      args,
      sourceInput,
      publishedRelease,
      baseImage,
      baseDigest,
      runDocker,
    });
  } finally {
    await rm(context, { recursive: true, force: true });
  }
}
