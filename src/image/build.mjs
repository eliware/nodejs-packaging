import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import loadPublishedRelease from "../repository/catalog.mjs";
import publishImage from "./publish.mjs";
import writeImageRecord from "./record.mjs";
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
  const pull = spawnSync("docker", ["pull", baseImage], { stdio: "inherit" });
  if (pull.error) throw pull.error;
  if (pull.status !== 0) throw new Error(`docker pull exited with status ${pull.status}`);
  const baseInspect = JSON.parse(
    spawnSync("docker", ["image", "inspect", baseImage], { encoding: "utf8" }).stdout,
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
    const build = spawnSync(
      "docker",
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
    if (build.error) throw build.error;
    if (build.status !== 0) throw new Error(`docker build exited with status ${build.status}`);

    const smoke = spawnSync("docker", ["run", "--rm", "--entrypoint", "node", image, "--version"], {
      encoding: "utf8",
    });
    if (smoke.error) throw smoke.error;
    if (smoke.status !== 0 || smoke.stdout.trim() !== `v${version}`)
      throw new Error(`image runtime check failed: ${smoke.stderr || smoke.stdout}`);
    for (const command of ["npm", "npx"]) {
      const check = spawnSync(
        "docker",
        ["run", "--rm", "--entrypoint", command, image, "--version"],
        {
          encoding: "utf8",
        },
      );
      if (check.error) throw check.error;
      if (check.status !== 0 || check.stdout.trim() !== publishedRelease.npm.version)
        throw new Error(`${command} runtime check failed: ${check.stderr || check.stdout}`);
    }

    let registryDigest = null;
    if (pushImage) registryDigest = await publishImage(image);

    const inspect = JSON.parse(
      spawnSync("docker", ["image", "inspect", image], { encoding: "utf8" }).stdout,
    )[0];
    const record = {
      repository: target.image,
      tag: version,
      digest: registryDigest,
      published: pushImage,
      local_image_id: inspect.Id,
      base_image: baseImage,
      base_image_digest: baseDigest,
      source_release: version,
      source_sha256: sourceInput.source.sha256,
      rpm_sha256: publishedRelease.package.sha256,
      repository_generation: publishedRelease.generation_id,
      validation: "passed",
      built_at: new Date().toISOString(),
    };
    const resultDir = path.resolve(
      args.get("output") || path.join(root, "artifacts/images", version),
    );
    await writeImageRecord(resultDir, record);
  } finally {
    await rm(context, { recursive: true, force: true });
  }
}
