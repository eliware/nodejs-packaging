import { createHash } from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const spawnSync = jest.fn();
const archive = Buffer.from("node archive bytes");
const npmArchive = Buffer.from("npm archive bytes");
const fingerprint = "A".repeat(40);
const archiveHash = createHash("sha256").update(archive).digest("hex");
const npmIntegrity = `sha512-${createHash("sha512").update(npmArchive).digest("base64")}`;
const release = {
  node_version: "26.13.1",
  source: {
    file: "node-v26.13.1-linux-x64.tar.xz",
    url: "https://nodejs.org/dist/v26.13.1/node-v26.13.1-linux-x64.tar.xz",
    checksums_file: "SHASUMS256.txt",
    checksums_url: "https://nodejs.org/dist/v26.13.1/SHASUMS256.txt",
    signature_file: "SHASUMS256.txt.sig",
    signature_url: "https://nodejs.org/dist/v26.13.1/SHASUMS256.txt.sig",
  },
};
const npmRelease = {
  version: "12.2.3",
  file: "npm-12.2.3.tgz",
  url: "https://registry.npmjs.org/npm/-/npm-12.2.3.tgz",
  integrity: npmIntegrity,
};
const discoverLatestRelease = jest.fn();
const discoverLatestNpm = jest.fn();
jest.unstable_mockModule("../src/discover/release.mjs", () => ({
  default: discoverLatestRelease,
}));
jest.unstable_mockModule("../src/discover/npm.mjs", () => ({ default: discoverLatestNpm }));
const streams = {
  createWriteStream: (file) => ({ file }),
  createReadStream: (file) => {
    const name = path.basename(file);
    return Readable.from([name.startsWith("node-v") ? archive : npmArchive]);
  },
};
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:fs", () => streams);
jest.unstable_mockModule("node:stream/promises", () => ({
  pipeline: async (body, output) => fs.writeFile(output.file, body),
}));
jest.unstable_mockModule("node:child_process", () => ({ spawnSync }));
const { default: main } = await import("../src/prepare-release.mjs");

function fetchResponse(url, body, options = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    ...(options.omitFinalUrl ? {} : { url: options.url || url }),
    body,
  };
}

async function setup() {
  const root = process.cwd();
  const output = "/virtual/sources";
  await fs.mkdir(path.join(root, "build-config"), { recursive: true });
  await fs.writeFile(
    path.join(root, "build-config/nodejs-release-keys.json"),
    JSON.stringify({ fingerprints: [fingerprint] }),
  );
  process.env.NODEJS_SOURCE_DIR = output;
  globalThis.fetch = jest.fn(async (url) => {
    if (url === release.source.url) return fetchResponse(url, archive, { omitFinalUrl: true });
    if (url === release.source.checksums_url)
      return fetchResponse(url, `${archiveHash} *${release.source.file}\n`);
    if (url === release.source.signature_url) return fetchResponse(url, Buffer.from("signature"));
    if (url === npmRelease.url) return fetchResponse(url, npmArchive);
    if (url.includes("pubring.kbx")) return fetchResponse(url, Buffer.from("keyring"));
    throw new Error(`unexpected download ${url}`);
  });
  discoverLatestRelease.mockReset().mockResolvedValue(release);
  discoverLatestNpm.mockReset().mockResolvedValue(npmRelease);
  spawnSync.mockReset().mockReturnValue({
    status: 0,
    stdout: `[GNUPG:] VALIDSIG ${fingerprint} 2026-01-01 1 0 4 0 1 10 ${fingerprint}\n`,
    stderr: "",
  });
  return { root, output };
}

function dependencies(overrides = {}) {
  return {
    discoverLatestRelease: async () => release,
    discoverLatestNpm: async () => npmRelease,
    ...overrides,
  };
}

test("rejects unsupported Node.js versions", async () => {
  await setup();
  await expect(main(["--version", "27.0.0"], dependencies())).rejects.toThrow(
    "unsupported Node.js 26 version: 27.0.0",
  );
  await expect(main(["--version", "26.0.0"], dependencies())).rejects.toThrow(
    "is not the latest stable Node.js 26 release 26.13.1",
  );
});

test("rejects source output paths inside tracked repository content", async () => {
  const { root } = await setup();
  process.env.NODEJS_SOURCE_DIR = path.join(root, "build-config/release-cache");
  try {
    await expect(main([], dependencies())).rejects.toThrow(
      "NODEJS_SOURCE_DIR must be outside the repository or under ignored .state",
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  } finally {
    delete process.env.NODEJS_SOURCE_DIR;
  }
});

test("uses default arguments, discovery functions, and source output paths", async () => {
  const { root } = await setup();
  delete process.env.NODEJS_SOURCE_DIR;
  const argv = process.argv;
  process.argv = [process.execPath, "prepare-release.mjs", "ignored"];
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    await main();
    expect(discoverLatestNpm).toHaveBeenCalledWith("latest");
    expect(globalThis.fetch).toHaveBeenCalledTimes(5);
    expect(spawnSync).toHaveBeenCalledWith("gpg", expect.any(Array), expect.any(Object));
    expect(stdout).toHaveBeenCalled();
    const record = JSON.parse(
      await fs.readFile(path.join(root, ".state/sources/26.13.1/release-input.json"), "utf8"),
    );
    expect(record).toMatchObject({
      release_id: "node-v26.13.1-el10-x86_64",
      source: { sha256: archiveHash, signing_key_fingerprint: fingerprint },
      npm: { version: "12.2.3", integrity: npmIntegrity },
    });
  } finally {
    process.argv = argv;
    stdout.mockRestore();
    delete process.env.NODEJS_SOURCE_DIR;
  }
});

test("prepares an explicitly selected older release with its own official URLs", async () => {
  await setup();
  const discoverLatestRelease = jest.fn(async (version) => ({
    ...release,
    node_version: version || release.node_version,
    source: {
      ...release.source,
      file: `node-v${version || release.node_version}-linux-x64.tar.xz`,
      url: `https://nodejs.org/dist/v${version || release.node_version}/node-v${version || release.node_version}-linux-x64.tar.xz`,
      checksums_url: `https://nodejs.org/dist/v${version || release.node_version}/SHASUMS256.txt`,
      signature_url: `https://nodejs.org/dist/v${version || release.node_version}/SHASUMS256.txt.sig`,
    },
  }));
  globalThis.fetch = jest.fn(async (url) => {
    if (url.endsWith("node-v26.12.0-linux-x64.tar.xz")) return fetchResponse(url, archive);
    if (url.endsWith("SHASUMS256.txt"))
      return fetchResponse(url, `${archiveHash} *node-v26.12.0-linux-x64.tar.xz\n`);
    if (url.endsWith(".sig")) return fetchResponse(url, Buffer.from("signature"));
    if (url === npmRelease.url) return fetchResponse(url, npmArchive);
    return fetchResponse(url, Buffer.from("keyring"));
  });
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    await main(
      ["--version", "26.12.0", "--allow-older", "true", "--npm-version", "12.2.3"],
      dependencies({ discoverLatestRelease }),
    );
    expect(discoverLatestRelease).toHaveBeenCalledTimes(2);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://nodejs.org/dist/v26.12.0/node-v26.12.0-linux-x64.tar.xz",
      expect.any(Object),
    );
  } finally {
    stdout.mockRestore();
    delete process.env.NODEJS_SOURCE_DIR;
  }
});

test("rejects unavailable, untrusted, and incomplete downloads", async () => {
  const { output } = await setup();
  globalThis.fetch.mockImplementation(async (url) =>
    fetchResponse(url, Buffer.from("x"), { ok: false, status: 503 }),
  );
  await expect(main(["--version", "26.13.1"], dependencies())).rejects.toThrow(
    "download failed with HTTP 503",
  );

  await setup();
  globalThis.fetch.mockImplementation(async (url) =>
    fetchResponse(url, Buffer.from("x"), { url: "http://evil.test/file" }),
  );
  await expect(main(["--version", "26.13.1"], dependencies())).rejects.toThrow(
    "download left the trusted HTTPS hosts",
  );

  await setup();
  globalThis.fetch.mockImplementation(async (url) => {
    if (url === release.source.url) return fetchResponse(url, archive);
    if (url === release.source.checksums_url) return fetchResponse(url, "");
    if (url === release.source.signature_url) return fetchResponse(url, Buffer.from("signature"));
    if (url === npmRelease.url) return fetchResponse(url, npmArchive);
    return fetchResponse(url, Buffer.from("keyring"));
  });
  await expect(main(["--version", "26.13.1"], dependencies())).rejects.toThrow(
    "checksum file has no unique entry",
  );
  delete process.env.NODEJS_SOURCE_DIR;
  expect(output).toBe("/virtual/sources");
});

test("rejects unapproved signing keys, checksum mismatches, and npm integrity mismatches", async () => {
  await setup();
  const unknown = "B".repeat(40);
  spawnSync.mockReturnValue({ status: 0, stdout: `[GNUPG:] VALIDSIG ${unknown}\n`, stderr: "" });
  await expect(main(["--version", "26.13.1"], dependencies())).rejects.toThrow("unapproved key");

  await setup();
  globalThis.fetch.mockImplementation(async (url) => {
    if (url === release.source.url) return fetchResponse(url, archive);
    if (url === release.source.checksums_url)
      return fetchResponse(url, `${"0".repeat(64)} *${release.source.file}\n`);
    if (url === release.source.signature_url) return fetchResponse(url, Buffer.from("signature"));
    if (url === npmRelease.url) return fetchResponse(url, npmArchive);
    return fetchResponse(url, Buffer.from("keyring"));
  });
  await expect(main(["--version", "26.13.1"], dependencies())).rejects.toThrow(
    "archive checksum mismatch",
  );

  await setup();
  await expect(
    main(
      ["--version", "26.13.1"],
      dependencies({ discoverLatestNpm: async () => ({ ...npmRelease, integrity: "sha512-bad" }) }),
    ),
  ).rejects.toThrow("npm archive integrity mismatch");
  delete process.env.NODEJS_SOURCE_DIR;
});
