import { createHash } from "node:crypto";
import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const execFileSync = jest.fn();
const spawnSync = jest.fn();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:child_process", () => ({ execFileSync, spawnSync }));
const { default: rpmModule } = await import("../../src/rpm/build.mjs");
const { main } = rpmModule();

const version = "26.13.1";
const nodeArchive = Buffer.from("verified-node-archive");
const npmArchive = Buffer.from("verified-npm-archive");
const sha256 = createHash("sha256").update(nodeArchive).digest("hex");
const integrity = `sha512-${createHash("sha512").update(npmArchive).digest("base64")}`;

async function setup() {
  const root = process.cwd();
  await fs.mkdir("/etc", { recursive: true });
  const releaseDir = path.join(root, ".state/sources", version);
  await fs.mkdir(releaseDir, { recursive: true });
  await fs.mkdir(path.join(root, "packaging"), { recursive: true });
  await fs.writeFile(path.join(root, "packaging/nodejs26.spec"), "spec");
  await fs.writeFile("/etc/os-release", 'ID="centos"\nVERSION_ID="10"\n');
  await fs.writeFile(path.join(releaseDir, "node.tar.xz"), nodeArchive);
  await fs.writeFile(path.join(releaseDir, "npm.tgz"), npmArchive);
  await fs.writeFile(
    path.join(releaseDir, "release-input.json"),
    JSON.stringify({
      node_version: version,
      target: { architecture: "x86_64", version: "10" },
      source: { file: "node.tar.xz", sha256 },
      npm: { version: "12.2.3", file: "npm.tgz", integrity },
    }),
  );
  execFileSync.mockReset().mockReturnValue("tool version\n");
  execFileSync.mockImplementation((command, args) =>
    args[0] === "-qp"
      ? "eliware-node26\n(none)\n26.13.1\n1.npm12.2.3.el10\nx86_64\n"
      : "tool version\n",
  );
  spawnSync.mockReset().mockImplementation((command, args) => {
    const rpmdirDefinition = args.find((argument) => argument.startsWith("_rpmdir "));
    const rpmdir = rpmdirDefinition?.slice("_rpmdir ".length);
    fs.mkdirSync(path.join(rpmdir, "x86_64"), { recursive: true });
    fs.writeFileSync(path.join(rpmdir, "x86_64/eliware-node26-26.13.1.rpm"), "built-rpm");
    fs.writeFileSync(path.join(rpmdir, "x86_64/build.log"), "ignored non-RPM output");
    return { status: 0, error: null };
  });
}

test("rejects non-Node.js 26 versions before reading release data", async () => {
  await expect(main([])).rejects.toThrow("pass --version VERSION or --release-input PATH");
  const argv = process.argv;
  process.argv = [process.execPath, "build-rpm.mjs"];
  try {
    await expect(main()).rejects.toThrow("pass --version VERSION or --release-input PATH");
  } finally {
    process.argv = argv;
  }
});

test("builds one EL10 x86_64 RPM with the verified Node.js and npm inputs", async () => {
  await setup();
  const output = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    await main(["--version", version, "ignored"]);
    const record = JSON.parse(
      await fs.readFile(
        path.join(process.cwd(), "artifacts/rpms", version, "package.json"),
        "utf8",
      ),
    );
    expect(record).toEqual(
      expect.objectContaining({
        name: "eliware-node26",
        version,
        npm_version: "12.2.3",
        architecture: "x86_64",
        sha256: expect.any(String),
      }),
    );
    expect(spawnSync).toHaveBeenCalledWith("rpmbuild", expect.any(Array), expect.any(Object));
    expect(output).toHaveBeenCalled();
  } finally {
    output.mockRestore();
  }
});

test("builds from an explicit release input and writes to a custom output", async () => {
  await setup();
  const releasePath = path.join(process.cwd(), ".state/sources", version, "release-input.json");
  const outputDir = "/virtual/rpm-output";
  execFileSync.mockImplementation((command, args) =>
    args[0] === "-qp" ? "eliware-node26\n0\n26.13.1\n1.npm12.2.3.el10\nx86_64\n" : "tool version\n",
  );
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    await main(["--release-input", releasePath, "--output", outputDir]);
    const record = JSON.parse(await fs.readFile(path.join(outputDir, "package.json"), "utf8"));
    expect(record.epoch).toBe(0);
    expect(record.path).toMatch(/\.rpm$/);
    expect(stdout).toHaveBeenCalled();
  } finally {
    stdout.mockRestore();
  }
});

test("rejects mismatched archive checksums and npm versions", async () => {
  await setup();
  const releasePath = path.join(process.cwd(), ".state/sources", version, "release-input.json");
  const input = JSON.parse(await fs.readFile(releasePath, "utf8"));
  input.source.sha256 = "bad";
  await fs.writeFile(releasePath, JSON.stringify(input));
  await expect(main(["--version", version])).rejects.toThrow("archive checksum does not match");
  input.source.sha256 = sha256;
  input.npm.version = "11.0.0";
  await fs.writeFile(releasePath, JSON.stringify(input));
  await expect(main(["--version", version])).rejects.toThrow(
    "include a verified npm package archive",
  );
  input.npm.version = "";
  await fs.writeFile(releasePath, JSON.stringify(input));
  await expect(main(["--version", version])).rejects.toThrow(
    "include a verified npm package archive",
  );
  delete input.npm;
  await fs.writeFile(releasePath, JSON.stringify(input));
  await expect(main(["--version", version])).rejects.toThrow(
    "include a verified npm package archive",
  );
  input.npm = { version: "12.2.3", file: "npm.tgz", integrity: "sha512-bad" };
  await fs.writeFile(releasePath, JSON.stringify(input));
  await expect(main(["--version", version])).rejects.toThrow(
    "npm archive integrity does not match",
  );
});

test("rejects invalid release targets and unsupported build hosts", async () => {
  await setup();
  const releasePath = path.join(process.cwd(), ".state/sources", version, "release-input.json");
  const original = JSON.parse(await fs.readFile(releasePath, "utf8"));
  const invalidVersion = { ...original, node_version: "" };
  await fs.writeFile(releasePath, JSON.stringify(invalidVersion));
  await expect(main(["--version", version])).rejects.toThrow("stable Node.js 26 version");
  await fs.writeFile(
    releasePath,
    JSON.stringify({ ...original, target: { architecture: "aarch64", version: "10" } }),
  );
  await expect(main(["--version", version])).rejects.toThrow(
    "does not target CentOS Stream 10 x86_64",
  );
  await fs.writeFile(releasePath, JSON.stringify(original));
  await fs.writeFile("/etc/os-release", 'ID="fedora"\nVERSION_ID="40"\n');
  await expect(main(["--version", version])).rejects.toThrow(
    "run RPM packaging on a CentOS Stream 10 host",
  );
  await fs.writeFile("/etc/os-release", 'ID="centos"\nVERSION_ID="9"\n');
  await expect(main(["--version", version])).rejects.toThrow(
    "run RPM packaging on a CentOS Stream 10 host",
  );
  await fs.writeFile("/etc/os-release", 'ID="centos"\nVERSION_ID="10"\n');
  const descriptor = Object.getOwnPropertyDescriptor(process, "arch");
  Object.defineProperty(process, "arch", { ...descriptor, value: "arm64" });
  try {
    await expect(main(["--version", version])).rejects.toThrow(
      "run RPM packaging on an x86_64 host",
    );
  } finally {
    Object.defineProperty(process, "arch", descriptor);
  }
});

test("reports RPM build, output count, and metadata failures", async () => {
  await setup();
  spawnSync.mockReturnValueOnce({ error: new Error("rpmbuild unavailable") });
  await expect(main(["--version", version])).rejects.toThrow("rpmbuild unavailable");

  await setup();
  spawnSync.mockReturnValueOnce({ status: 1 });
  await expect(main(["--version", version])).rejects.toThrow("rpmbuild exited with status 1");

  await setup();
  spawnSync.mockImplementation((command, args) => {
    const rpmdir = args.find((argument) => argument.startsWith("_rpmdir ")).slice(8);
    fs.mkdirSync(path.join(rpmdir, "x86_64"), { recursive: true });
    return { status: 0 };
  });
  await expect(main(["--version", version])).rejects.toThrow("expected one RPM, found 0");

  await setup();
  execFileSync.mockImplementation((command, args) =>
    args[0] === "-qp" ? "wrong\n(none)\n26.13.1\n1\nx86_64\n" : "version",
  );
  await expect(main(["--version", version])).rejects.toThrow(
    "built RPM metadata does not match target",
  );
});
