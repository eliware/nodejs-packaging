import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import loadPublishedRelease from "../repository/catalog.mjs";
import runDocker from "./docker.mjs";
import publishImage from "./publication.mjs";
import verifyImageRuntime from "./runtime-check.mjs";
export default async function main(argv = process.argv.slice(2)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith("--")) args.set(argv[index].slice(2), argv[++index]);
  }
  const version = args.get("version");
  const pushImage = args.has("push");
  if (!/^26\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version || ""))
    throw new Error("pass a stable Node.js 26 version with --version");

  const { repositoryBase, publishedRelease } = await loadPublishedRelease(
    version,
    process.env.NODEJS_REPOSITORY_URL,
    fetch,
  );

  const sourceInput = JSON.parse(
    await readFile(path.join(root, ".state/sources", version, "release-input.json"), "utf8"),
  );
  const target = JSON.parse(await readFile(path.join(root, "build-config/target.json"), "utf8"));
  const image = `${target.image}:${version}`;
  const baseImage = "quay.io/centos/centos:stream10";
  runDocker(["pull", baseImage], { stdio: "inherit" });
  const baseInspect = JSON.parse(
    runDocker(["image", "inspect", baseImage], { encoding: "utf8" }).stdout,
  )[0];
  const baseDigest = (baseInspect.RepoDigests || []).find((digest) =>
    digest.startsWith("quay.io/centos/centos@sha256:"),
  );
  if (!baseDigest) throw new Error(`Docker did not report an immutable digest for ${baseImage}`);
  const expectedBaseDigest = args.get("base-digest");
  if (expectedBaseDigest && baseDigest !== expectedBaseDigest)
    throw new Error(
      `CentOS base image changed during the conductor run: expected ${expectedBaseDigest}, found ${baseDigest}`,
    );
  const context = await mkdtemp(path.join(os.tmpdir(), "centos10-node26-image-"));
  try {
    runDocker(
      [
        "build",
        "--file",
        path.join(root, "containers/centos10-node26.Dockerfile"),
        "--build-arg",
        `NODE_VERSION=${version}`,
        "--build-arg",
        `SOURCE_SHA256=${sourceInput.source.sha256}`,
        "--build-arg",
        `BASE_IMAGE_DIGEST=${baseDigest.slice(baseDigest.lastIndexOf("@") + 1)}`,
        "--build-arg",
        `NODEJS_REPOSITORY_URL=${repositoryBase}`,
        "--build-arg",
        `REPOSITORY_GENERATION=${publishedRelease.generation_id}`,
        "--tag",
        image,
        context,
      ],
      { stdio: "inherit" },
    );

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
