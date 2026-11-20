import { expect, jest, test } from "@jest/globals";
import loadRpmInput from "../../src/rpm/input.mjs";

const root = "/virtual/rpm";
const releasePath = `${root}/.state/sources/26.13.1/release-input.json`;
const nodeHash = "node-sha256";
const npmHash = "npm-sha512";

function releaseInput(overrides = {}) {
  return {
    node_version: "26.13.1",
    target: { architecture: "x86_64", version: "10" },
    source: { file: "node.tar.xz", sha256: nodeHash },
    npm: { version: "12.2.3", file: "npm.tgz", integrity: `sha512-${npmHash}` },
    ...overrides,
  };
}

function dependencies(input = releaseInput(), overrides = {}) {
  const readFile = jest.fn(async (file) => {
    if (file === releasePath) return JSON.stringify(input);
    throw new Error(`unexpected read: ${file}`);
  });
  const hashFile = jest.fn().mockResolvedValueOnce(nodeHash).mockResolvedValueOnce(npmHash);
  return {
    readFile,
    hashFile,
    root,
    osRelease: 'ID="centos"\nVERSION_ID="10"\n',
    architecture: "x64",
    ...overrides,
  };
}

test("validates release archives and returns the packaging inputs", async () => {
  const injected = dependencies();
  const result = await loadRpmInput(["--version", "26.13.1", "--output", "/tmp/rpm"], injected);
  expect(result).toMatchObject({
    version: "26.13.1",
    archive: `${root}/.state/sources/26.13.1/node.tar.xz`,
    npmArchive: `${root}/.state/sources/26.13.1/npm.tgz`,
  });
  expect(result.args.get("output")).toBe("/tmp/rpm");
  const explicit = dependencies();
  explicit.root = undefined;
  await loadRpmInput(["--release-input", releasePath], explicit);
  expect(injected.hashFile).toHaveBeenNthCalledWith(2, result.npmArchive, "sha512", "base64");
});

test("rejects missing, invalid, and unsupported release inputs", async () => {
  await expect(loadRpmInput([])).rejects.toThrow("pass --version VERSION");
  await expect(loadRpmInput([], dependencies())).rejects.toThrow(
    "pass --version VERSION or --release-input PATH",
  );
  await expect(
    loadRpmInput(["--version", "26.13.1"], dependencies(releaseInput({ node_version: "27.0.0" }))),
  ).rejects.toThrow("stable Node.js 26 version");
  await expect(
    loadRpmInput(["--version", "26.13.1"], dependencies(releaseInput({ target: {} }))),
  ).rejects.toThrow("does not target CentOS Stream 10");
});

test("requires the CentOS Stream 10 x86_64 build host", async () => {
  await expect(
    loadRpmInput(
      ["--version", "26.13.1"],
      dependencies(releaseInput(), { osRelease: "ID=ubuntu" }),
    ),
  ).rejects.toThrow("CentOS Stream 10 host");
  await expect(
    loadRpmInput(["--version", "26.13.1"], dependencies(releaseInput(), { architecture: "arm64" })),
  ).rejects.toThrow("x86_64 host");
});

test("rejects invalid archive checksum and npm package metadata", async () => {
  const archiveMismatch = dependencies();
  archiveMismatch.hashFile.mockReset().mockResolvedValueOnce("wrong");
  await expect(loadRpmInput(["--version", "26.13.1"], archiveMismatch)).rejects.toThrow(
    "archive checksum does not match",
  );

  await expect(
    loadRpmInput(["--version", "26.13.1"], dependencies(releaseInput({ npm: null }))),
  ).rejects.toThrow("verified npm package archive");
  await expect(
    loadRpmInput(
      ["--version", "26.13.1"],
      dependencies(releaseInput({ npm: { version: "11.0.0", file: "npm.tgz", integrity: "x" } })),
    ),
  ).rejects.toThrow("verified npm package archive");

  const integrityMismatch = dependencies();
  integrityMismatch.hashFile
    .mockReset()
    .mockResolvedValueOnce(nodeHash)
    .mockResolvedValueOnce("wrong");
  await expect(loadRpmInput(["--version", "26.13.1"], integrityMismatch)).rejects.toThrow(
    "npm archive integrity does not match",
  );
});
