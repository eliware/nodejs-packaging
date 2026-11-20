import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const spawnSync = jest.fn();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:fs", () => ({ createReadStream: fs.createReadStream }));
jest.unstable_mockModule("node:child_process", () => ({ spawnSync }));
const { default: main } = await import("../src/generate-repository.mjs");

async function setup() {
  const root = process.cwd();
  const packageDir = "/virtual/packages";
  const version = "26.13.1";
  await fs.mkdir(path.join(root, "templates"), { recursive: true });
  await fs.writeFile(path.join(root, "templates/nodejs26.repo"), "[nodejs26]\n");
  await fs.writeFile(
    path.join(root, "templates/catalog.seed.json"),
    JSON.stringify({ metadata_version: "0.1.0", stable: { items: [] } }),
  );
  await fs.mkdir(packageDir, { recursive: true });
  await fs.writeFile(path.join(packageDir, "node.rpm"), "rpm data");
  await fs.writeFile(
    path.join(packageDir, "package.json"),
    JSON.stringify({
      name: "eliware-node26",
      version,
      npm_version: "12.2.3",
      path: "node.rpm",
      sha256: "a".repeat(64),
      size: 8,
    }),
  );
  await fs.mkdir(path.join(root, ".state/sources", version), { recursive: true });
  await fs.writeFile(
    path.join(root, ".state/sources", version, "release-input.json"),
    JSON.stringify({ source: { sha256: "b".repeat(64) }, npm: { version: "12.2.3" } }),
  );
  spawnSync.mockReset();
  spawnSync.mockImplementation((command, args) => {
    const repositoryDir = args.at(-1);
    fs.mkdirSync(path.join(repositoryDir, "repodata"), { recursive: true });
    fs.writeFileSync(path.join(repositoryDir, "repodata/repomd.xml"), "repository metadata");
    return { status: 0, stderr: "" };
  });
  return { root, packageDir, version };
}

test("requires a valid stable Node.js 26 version", async () => {
  await expect(main()).rejects.toThrow("pass a stable Node.js 26 version with --version");
  await expect(main([])).rejects.toThrow("pass a stable Node.js 26 version with --version");
  await expect(main(["--version", "27.0.0"])).rejects.toThrow(
    "pass a stable Node.js 26 version with --version",
  );
});

test("generates a signed repository candidate layout and metadata", async () => {
  const { root, packageDir, version } = await setup();
  const output = "/virtual/generated/repository";
  const write = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    await main(["--version", version, "ignored", "--rpm-dir", packageDir, "--output", output]);
    const catalog = JSON.parse(
      await fs.readFile(path.join(output, "metadata/catalog.json"), "utf8"),
    );
    const manifest = JSON.parse(
      await fs.readFile(path.join(output, "metadata/release-manifest.json"), "utf8"),
    );
    const index = JSON.parse(
      await fs.readFile(path.join(output, "metadata/repository-index.json"), "utf8"),
    );
    expect(catalog.stable.latest.node_version).toBe(version);
    expect(manifest.publication_ready).toBe(false);
    expect(manifest.repository_metadata_sha256).toEqual(expect.any(String));
    expect(index.directories["/"].entries).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "el10" })]),
    );
    expect(await fs.readFile(path.join(output, "nodejs26.repo"), "utf8")).toContain("[nodejs26]");
    expect(spawnSync).toHaveBeenCalledWith(
      "createrepo_c",
      ["--checksum", "sha256", expect.stringMatching(/[\\/]stable$/)],
      expect.any(Object),
    );
    expect(write).toHaveBeenCalled();
    expect(root).toBe(process.cwd());
  } finally {
    write.mockRestore();
  }

  const defaultPackageDir = path.join(root, "artifacts/rpms", version);
  await fs.mkdir(defaultPackageDir, { recursive: true });
  await fs.writeFile(path.join(defaultPackageDir, "node.rpm"), "rpm data");
  await fs.writeFile(
    path.join(defaultPackageDir, "package.json"),
    JSON.stringify({
      name: "eliware-node26",
      version,
      npm_version: "12.2.3",
      path: "node.rpm",
      sha256: "a".repeat(64),
      size: 8,
    }),
  );
  const defaultWrite = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    await expect(main(["--version", version])).resolves.toBeUndefined();
  } finally {
    defaultWrite.mockRestore();
  }
});

test("rejects mismatched package records, existing output, and repository tool failures", async () => {
  const { packageDir, version } = await setup();
  const recordPath = path.join(packageDir, "package.json");
  await fs.writeFile(recordPath, JSON.stringify({ name: "wrong", version }));
  await expect(main(["--version", version, "--rpm-dir", packageDir])).rejects.toThrow(
    "RPM record does not match the requested Node.js version",
  );

  await setup();
  await fs.mkdir("/virtual/existing", { recursive: true });
  await expect(
    main(["--version", version, "--rpm-dir", packageDir, "--output", "/virtual/existing"]),
  ).rejects.toThrow("candidate output already exists");

  await setup();
  spawnSync.mockReturnValue({ status: 1, stderr: "tool failed" });
  await expect(
    main(["--version", version, "--rpm-dir", packageDir, "--output", "/virtual/failed"]),
  ).rejects.toThrow("createrepo_c exited with status 1: tool failed");
  await setup();
  spawnSync.mockReturnValue({ status: 0, error: new Error("tool missing") });
  await expect(
    main(["--version", version, "--rpm-dir", packageDir, "--output", "/virtual/missing"]),
  ).rejects.toThrow("tool missing");
});
