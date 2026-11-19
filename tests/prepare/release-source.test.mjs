import { expect, jest, test } from "@jest/globals";
const spawnSync = jest.fn();
jest.unstable_mockModule("node:child_process", () => ({ spawnSync }));
const { default: releaseSourceModule } = await import("../../src/prepare/release-source.mjs");

const { resolveReleaseVersion, verifySignature, checksumForFile } = releaseSourceModule();

test("uses the selected release when versions match or older releases are disallowed", async () => {
  const selected = { node_version: "26.13.1" };
  const discover = jest.fn();
  await expect(resolveReleaseVersion("26.13.1", selected, true, discover)).resolves.toBe(selected);
  await expect(resolveReleaseVersion("26.12.0", selected, false, discover)).resolves.toBe(selected);
  expect(discover).not.toHaveBeenCalled();
});

test("creates official source paths for a requested older version", async () => {
  const discover = jest.fn(async () => ({ node_version: "26.13.1" }));
  const release = await resolveReleaseVersion(
    "26.12.0",
    { node_version: "26.13.1" },
    true,
    discover,
  );
  expect(discover).toHaveBeenCalledTimes(1);
  expect(release.source).toEqual({
    file: "node-v26.12.0-linux-x64.tar.xz",
    url: "https://nodejs.org/dist/v26.12.0/node-v26.12.0-linux-x64.tar.xz",
    checksums_file: "SHASUMS256.txt",
    checksums_url: "https://nodejs.org/dist/v26.12.0/SHASUMS256.txt",
    signature_file: "SHASUMS256.txt.sig",
    signature_url: "https://nodejs.org/dist/v26.12.0/SHASUMS256.txt.sig",
  });
});

test("extracts the primary signing key fingerprint", () => {
  const run = jest.fn(() => ({
    status: 0,
    stdout: `[GNUPG:] VALIDSIG ${"A".repeat(40)} 2026-01-01 1 0 4 0 1 10 ${"B".repeat(40)}\n`,
    stderr: "",
  }));
  expect(verifySignature("/keys", "/sig", "/sums", run)).toBe("B".repeat(40));
  expect(run).toHaveBeenCalledWith(
    "gpg",
    expect.any(Array),
    expect.objectContaining({ timeout: 30_000 }),
  );
});

test("uses the default GnuPG runner", () => {
  spawnSync.mockReturnValue({
    status: 0,
    stdout: `[GNUPG:] VALIDSIG ${"A".repeat(40)} 2026-01-01 1 0 4 0 1 10 ${"B".repeat(40)}\n`,
    stderr: "",
  });
  expect(verifySignature("/keys", "/sig", "/sums")).toBe("B".repeat(40));
  expect(spawnSync).toHaveBeenCalledWith("gpg", expect.any(Array), expect.any(Object));
});

test("reports GnuPG failures and invalid status output", () => {
  const failed = jest.fn(() => ({ status: 2, stdout: "", stderr: "bad signature" }));
  expect(() => verifySignature("/keys", "/sig", "/sums", failed)).toThrow(
    "Node.js checksum signature verification failed: bad signature",
  );
  const invalid = jest.fn(() => ({ status: 0, stdout: "GOODSIG only", stderr: "" }));
  expect(() => verifySignature("/keys", "/sig", "/sums", invalid)).toThrow(
    "GnuPG did not report a valid Node.js checksum signature",
  );
  const spawnError = new Error("gpg unavailable");
  expect(() => verifySignature("/keys", "/sig", "/sums", () => ({ error: spawnError }))).toThrow(
    spawnError,
  );
});

test("selects a unique archive checksum", () => {
  const checksum = "a".repeat(64);
  expect(checksumForFile(`${checksum} *node.tar.xz\n`, "node.tar.xz")).toBe(checksum);
  expect(() => checksumForFile("", "node.tar.xz")).toThrow("no unique entry");
  expect(() =>
    checksumForFile(`${checksum} node.tar.xz\n${checksum} *node.tar.xz`, "node.tar.xz"),
  ).toThrow("no unique entry");
});
