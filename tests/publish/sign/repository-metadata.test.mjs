import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const sign = jest.fn(async () => {});
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("../../../src/publish/sign.mjs", () => ({ default: sign }));
const { default: signRepositoryMetadata } =
  await import("../../../src/publish/sign/repository-metadata.mjs");

test("rebuilds repository metadata and signs its public artifacts", async () => {
  const root = "/virtual/signed-generation";
  const stable = path.join(root, "el10/x86_64/stable");
  const provenancePath = path.join(root, "metadata/provenance/package.json");
  await fs.mkdir(path.join(stable, "repodata"), { recursive: true });
  await fs.mkdir(path.dirname(provenancePath), { recursive: true });
  await fs.writeFile(path.join(stable, "repodata/old.xml"), "old");
  await fs.writeFile(provenancePath, "provenance");
  const run = jest.fn(async (command) => {
    if (command === "createrepo_c") {
      await fs.mkdir(path.join(stable, "repodata"), { recursive: true });
      await fs.writeFile(path.join(stable, "repodata/repomd.xml"), "repomd");
    }
    return { stdout: command === "gpg" ? "PUBLIC KEY" : "" };
  });
  await signRepositoryMetadata({
    stagingRoot: root,
    keyFingerprint: "B".repeat(40),
    gpgHome: "/keys",
    run,
    provenancePath,
  });
  expect(run).toHaveBeenCalledWith("createrepo_c", ["--checksum", "sha256", stable]);
  expect(run).toHaveBeenCalledWith("gpg", ["--batch", "--armor", "--export", "B".repeat(40)], {
    GNUPGHOME: "/keys",
  });
  expect(sign).toHaveBeenCalledWith(
    path.join(stable, "repodata/repomd.xml"),
    "B".repeat(40),
    "/keys",
  );
  expect(sign).toHaveBeenCalledWith(provenancePath, "B".repeat(40), "/keys");
  await expect(
    fs.readFile(path.join(root, "keys/RPM-GPG-KEY-ELIWARE-NODEJS"), "utf8"),
  ).resolves.toBe("PUBLIC KEY");
});
