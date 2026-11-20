import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const spawnSync = jest.fn();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:child_process", () => ({ spawnSync }));
const { default: main } = await import("../../src/image/build.mjs");

const version = "26.13.1";
const sourceSha = "a".repeat(64);
const rpmSha = "b".repeat(64);
const registryDigest = `sha256:${"c".repeat(64)}`;
const baseDigest = `quay.io/centos/centos@sha256:${"d".repeat(64)}`;
const catalog = {
  metadata_version: "0.1.0",
  node_major: 26,
  target: { architecture: "x86_64" },
  stable: {
    latest: {
      node_version: version,
      package: { name: "eliware-node26", sha256: rpmSha },
      npm: { version: "12.2.3" },
      generation_id: "generation-1",
    },
  },
};

async function setup() {
  const root = process.cwd();
  await fs.mkdir(path.join(root, ".state/sources", version), { recursive: true });
  await fs.mkdir(path.join(root, "build-config"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".state/sources", version, "release-input.json"),
    JSON.stringify({ source: { sha256: sourceSha } }),
  );
  await fs.writeFile(
    path.join(root, "build-config/target.json"),
    JSON.stringify({ image: "ghcr.io/eliware/centos10-node26" }),
  );
  process.env.NODEJS_REPOSITORY_URL = "https://nodejs.eliware.org";
  globalThis.fetch = jest.fn(async () => ({ ok: true, json: async () => catalog }));
}

function dockerScenario(overrides = {}) {
  let pushIndex = 0;
  spawnSync.mockImplementation((command, args) => {
    if (args[0] === "pull") return overrides.pull || { status: 0 };
    if (args[0] === "image" && args[2] === "quay.io/centos/centos:stream10")
      return (
        overrides.baseInspect || {
          status: 0,
          stdout: JSON.stringify([{ RepoDigests: [baseDigest] }]),
        }
      );
    if (args[0] === "build") return overrides.build || { status: 0 };
    if (args[0] === "run") {
      const commandName = args[args.indexOf("--entrypoint") + 1];
      return (
        overrides[commandName] || {
          status: 0,
          stdout: commandName === "node" ? `v${version}\n` : "12.2.3\n",
        }
      );
    }
    if (args[0] === "tag") return overrides.tag || { status: 0 };
    if (args[0] === "push")
      return (
        overrides.pushes?.[pushIndex++] ||
        overrides.push || { status: 0, stdout: `digest: ${registryDigest}\n` }
      );
    return { status: 0, stdout: JSON.stringify([{ Id: "sha256:local" }]) };
  });
}

function successfulDocker() {
  spawnSync.mockImplementation((command, args) => {
    if (args[0] === "image" && args[2] === "quay.io/centos/centos:stream10")
      return { status: 0, stdout: JSON.stringify([{ RepoDigests: [baseDigest] }]), stderr: "" };
    if (args[0] === "image" && args[2] !== "quay.io/centos/centos:stream10")
      return { status: 0, stdout: JSON.stringify([{ Id: "sha256:local" }]), stderr: "" };
    if (args[0] === "run") {
      const commandName = args[args.indexOf("--entrypoint") + 1];
      return {
        status: 0,
        stdout: commandName === "node" ? `v${version}\n` : "12.2.3\n",
        stderr: "",
      };
    }
    if (args[0] === "push") return { status: 0, stdout: `digest: ${registryDigest}\n`, stderr: "" };
    return { status: 0, stdout: "", stderr: "" };
  });
}

test("rejects a non-Node.js 26 image version before accessing the repository", async () => {
  await expect(main(["--version", "25.0.0"])).rejects.toThrow(
    "pass a stable Node.js 26 version with --version",
  );
  await expect(main(["--version", ""])).rejects.toThrow(
    "pass a stable Node.js 26 version with --version",
  );
  const argv = process.argv;
  process.argv = [process.execPath, "build-image.mjs"];
  try {
    await expect(main()).rejects.toThrow("pass a stable Node.js 26 version with --version");
  } finally {
    process.argv = argv;
  }
});

test("builds and smoke-checks the image without publishing it", async () => {
  await setup();
  successfulDocker();
  const output = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    await main(["--version", version, "ignored"]);
    const record = JSON.parse(
      await fs.readFile(
        path.join(process.cwd(), "artifacts/images", version, "image.json"),
        "utf8",
      ),
    );
    expect(record).toEqual(
      expect.objectContaining({
        repository: "ghcr.io/eliware/centos10-node26",
        tag: version,
        digest: null,
        published: false,
        base_image_digest: baseDigest,
        validation: "passed",
      }),
    );
    expect(spawnSync).toHaveBeenCalledWith(
      "docker",
      expect.arrayContaining([`REPOSITORY_GENERATION=generation-1`]),
      expect.any(Object),
    );
    expect(output).toHaveBeenCalled();
  } finally {
    output.mockRestore();
    delete process.env.NODEJS_REPOSITORY_URL;
  }
});

test("pushes a checked image and records the registry digest", async () => {
  await setup();
  successfulDocker();
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    await main(["--version", version, "--push"]);
    const record = JSON.parse(
      await fs.readFile(
        path.join(process.cwd(), "artifacts/images", version, "image.json"),
        "utf8",
      ),
    );
    expect(record).toEqual(expect.objectContaining({ digest: registryDigest, published: true }));
    expect(spawnSync).toHaveBeenCalledWith(
      "docker",
      ["push", `ghcr.io/eliware/centos10-node26:${version}`],
      expect.any(Object),
    );
    expect(spawnSync).toHaveBeenCalledWith(
      "docker",
      [
        "tag",
        `ghcr.io/eliware/centos10-node26:${version}`,
        "ghcr.io/eliware/centos10-node26:latest",
      ],
      expect.any(Object),
    );
    expect(spawnSync).toHaveBeenCalledWith(
      "docker",
      ["push", "ghcr.io/eliware/centos10-node26:latest"],
      expect.any(Object),
    );
  } finally {
    stdout.mockRestore();
    delete process.env.NODEJS_REPOSITORY_URL;
  }
});

test("rejects a changed base image and a Docker build failure", async () => {
  await setup();
  successfulDocker();
  await expect(main(["--version", version, "--base-digest", "old-digest"])).rejects.toThrow(
    "CentOS base image changed during the conductor run",
  );
  successfulDocker();
  spawnSync.mockImplementation((command, args) =>
    args[0] === "image" && args[2] === "quay.io/centos/centos:stream10"
      ? { status: 0, stdout: JSON.stringify([{ RepoDigests: [baseDigest] }]), stderr: "" }
      : args[0] === "build"
        ? { status: 1, stdout: "", stderr: "build failed" }
        : { status: 0, stdout: "", stderr: "" },
  );
  await expect(main(["--version", version])).rejects.toThrow("docker build exited with status 1");
  delete process.env.NODEJS_REPOSITORY_URL;
});

test("reports Docker pull, digest, build, and runtime smoke-check failures", async () => {
  await setup();
  dockerScenario({ pull: { error: new Error("docker missing") } });
  await expect(main(["--version", version])).rejects.toThrow("docker missing");

  await setup();
  dockerScenario({ pull: { status: 1 } });
  await expect(main(["--version", version])).rejects.toThrow("docker pull exited with status 1");

  await setup();
  dockerScenario({ baseInspect: { status: 0, stdout: JSON.stringify([{ RepoDigests: [] }]) } });
  await expect(main(["--version", version])).rejects.toThrow("immutable digest");

  await setup();
  dockerScenario({ baseInspect: { status: 0, stdout: JSON.stringify([{}]) } });
  await expect(main(["--version", version])).rejects.toThrow("immutable digest");

  await setup();
  dockerScenario({ build: { error: new Error("builder missing") } });
  await expect(main(["--version", version])).rejects.toThrow("builder missing");

  await setup();
  dockerScenario({ node: { error: new Error("node runtime failed") } });
  await expect(main(["--version", version])).rejects.toThrow("node runtime failed");

  await setup();
  dockerScenario({ node: { status: 1, stdout: "", stderr: "node failed" } });
  await expect(main(["--version", version])).rejects.toThrow(
    "image runtime check failed: node failed",
  );

  await setup();
  dockerScenario({ node: { status: 0, stdout: "wrong\n", stderr: "" } });
  await expect(main(["--version", version])).rejects.toThrow("image runtime check failed: wrong");

  await setup();
  dockerScenario({ npm: { error: new Error("npm missing") } });
  await expect(main(["--version", version])).rejects.toThrow("npm missing");

  await setup();
  dockerScenario({ npx: { status: 0, stdout: "wrong\n" } });
  await expect(main(["--version", version])).rejects.toThrow("npx runtime check failed: wrong");
  delete process.env.NODEJS_REPOSITORY_URL;
});

test("reports registry push errors, failures, and missing digests", async () => {
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  try {
    await setup();
    dockerScenario({ push: { error: new Error("push unavailable") } });
    await expect(main(["--version", version, "--push"])).rejects.toThrow("push unavailable");

    await setup();
    dockerScenario({ push: { status: 1, stdout: "upload output", stderr: "push failed" } });
    await expect(main(["--version", version, "--push"])).rejects.toThrow(
      "docker push exited with status 1",
    );
    expect(stdout).toHaveBeenCalledWith("upload output");
    expect(stderr).toHaveBeenCalledWith("push failed");

    await setup();
    dockerScenario({ push: { status: 0, stdout: "pushed", stderr: "" } });
    await expect(main(["--version", version, "--push"])).rejects.toThrow(
      "docker push completed without reporting an image digest",
    );

    await setup();
    dockerScenario({ push: { status: 0, stdout: "", stderr: `digest: ${registryDigest}` } });
    const output = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    await main(["--version", version, "--push"]);
    expect(stderr).toHaveBeenCalledWith(`digest: ${registryDigest}`);
    output.mockRestore();
  } finally {
    stdout.mockRestore();
    stderr.mockRestore();
    delete process.env.NODEJS_REPOSITORY_URL;
  }
});
test("reports latest tagging failures and digest mismatches", async () => {
  const output = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  await setup();
  dockerScenario({ tag: { error: new Error("tag unavailable") } });
  await expect(main(["--version", version, "--push"])).rejects.toThrow("tag unavailable");
  await setup();
  dockerScenario({ tag: { status: 1 } });
  await expect(main(["--version", version, "--push"])).rejects.toThrow("status 1");
  await setup();
  dockerScenario({
    pushes: [
      { status: 0, stdout: `digest: ${registryDigest}\n` },
      { status: 0, stdout: `digest: sha256:${"e".repeat(64)}\n` },
    ],
  });
  await expect(main(["--version", version, "--push"])).rejects.toThrow(/latest image digest/);
  delete process.env.NODEJS_REPOSITORY_URL;
  output.mockRestore();
});
