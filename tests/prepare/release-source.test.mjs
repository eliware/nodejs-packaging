import { expect, jest, test } from "@jest/globals";
import resolveReleaseVersion from "../../src/prepare/release-source.mjs";

test("uses the selected release when versions match or older releases are disallowed", async () => {
  const selected = { node_version: "26.13.1" };
  const discover = jest.fn();
  await expect(resolveReleaseVersion("26.13.1", selected, true, discover)).resolves.toBe(selected);
  await expect(resolveReleaseVersion("26.12.0", selected, false, discover)).resolves.toBe(selected);
  expect(discover).not.toHaveBeenCalled();
});

test("creates official source paths for a requested older version", async () => {
  const olderRelease = {
    node_version: "26.12.0",
    source: {
      file: "node-v26.12.0-linux-x64.tar.xz",
      url: "https://nodejs.org/dist/v26.12.0/node-v26.12.0-linux-x64.tar.xz",
      checksums_file: "SHASUMS256.txt",
      checksums_url: "https://nodejs.org/dist/v26.12.0/SHASUMS256.txt",
      signature_file: "SHASUMS256.txt.sig",
      signature_url: "https://nodejs.org/dist/v26.12.0/SHASUMS256.txt.sig",
    },
  };
  const discover = jest.fn(async () => olderRelease);
  const release = await resolveReleaseVersion(
    "26.12.0",
    { node_version: "26.13.1" },
    true,
    discover,
  );
  expect(discover).toHaveBeenCalledTimes(1);
  expect(discover).toHaveBeenCalledWith("26.12.0");
  expect(release).toBe(olderRelease);
});

test("rejects a requested older version that the release index does not confirm", async () => {
  await expect(
    resolveReleaseVersion("26.12.0", { node_version: "26.13.1" }, true, async () => ({
      node_version: "26.13.1",
    })),
  ).rejects.toThrow("Node.js 26.12.0 is not an available stable release");
});
