import { expect, jest, test } from "@jest/globals";
import downloadReleaseInputs from "../../src/prepare/download-inputs.mjs";

test("downloads release archives and the verification keyring from trusted hosts", async () => {
  const downloadFile = jest.fn(async () => {});
  await downloadReleaseInputs({
    release: {
      source: {
        url: "https://nodejs.org/node.tar.xz",
        checksums_url: "https://nodejs.org/SHA256SUMS",
        signature_url: "https://nodejs.org/SHA256SUMS.sig",
      },
    },
    npmRelease: { url: "https://registry.npmjs.org/npm.tgz" },
    archivePath: "/cache/node.tar.xz",
    checksumsPath: "/cache/SHA256SUMS",
    signaturePath: "/cache/SHA256SUMS.sig",
    npmArchivePath: "/cache/npm.tgz",
    keyringPath: "/cache/pubring.kbx",
    downloadFile,
  });
  expect(downloadFile).toHaveBeenCalledTimes(5);
  expect(downloadFile).toHaveBeenNthCalledWith(
    1,
    "https://nodejs.org/node.tar.xz",
    "/cache/node.tar.xz",
    ["nodejs.org", "raw.githubusercontent.com"],
  );
  expect(downloadFile).toHaveBeenNthCalledWith(
    4,
    "https://registry.npmjs.org/npm.tgz",
    "/cache/npm.tgz",
    ["registry.npmjs.org"],
  );
  expect(downloadFile).toHaveBeenNthCalledWith(
    5,
    "https://raw.githubusercontent.com/nodejs/release-keys/main/gpg-only-active-keys/pubring.kbx",
    "/cache/pubring.kbx",
    ["nodejs.org", "raw.githubusercontent.com"],
  );
});
