import { expect, jest, test } from "@jest/globals";

const defaultSpawn = jest.fn(() => ({ status: 0, stdout: "", stderr: "" }));
jest.unstable_mockModule("node:child_process", () => ({ spawnSync: defaultSpawn }));
const { default: sign } = await import("../../src/publish/sign.mjs");

test("signs a file with the selected GnuPG key home", async () => {
  const spawn = jest.fn(() => ({ status: 0, stdout: "", stderr: "" }));
  await expect(sign("release.json", "F".repeat(40), "/keys", spawn)).resolves.toBeUndefined();
  expect(spawn).toHaveBeenCalledWith(
    "gpg",
    [
      "--batch",
      "--yes",
      "--local-user",
      "F".repeat(40),
      "--armor",
      "--detach-sign",
      "release.json",
    ],
    expect.objectContaining({ env: expect.objectContaining({ GNUPGHOME: "/keys" }) }),
  );
});

test("reports GnuPG launch and signing failures", async () => {
  const failure = new Error("spawn failed");
  await expect(sign("file", "F".repeat(40), "/keys", () => ({ error: failure }))).rejects.toBe(
    failure,
  );
  await expect(
    sign("file", "F".repeat(40), "/keys", () => ({ status: 2, stderr: "bad key" })),
  ).rejects.toThrow("gpg exited with status 2: bad key");
  await expect(sign("file", "F".repeat(40), "/keys")).resolves.toBeUndefined();
  expect(defaultSpawn).toHaveBeenCalled();
});
