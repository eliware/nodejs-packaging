import path from "node:path";
import { expect, test } from "@jest/globals";
import memoryFilesystemFixture from "../../../test-fixtures/memory-fs.mjs";
import loadReleaseRpmInput from "../../../src/publish/release/rpm-input.mjs";
const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();

async function prepareCandidate(names) {
  const root = "/virtual/release-rpm";
  await fs.mkdir(path.join(root, "metadata"), { recursive: true });
  await fs.writeFile(
    path.join(root, "metadata/release-manifest.json"),
    JSON.stringify({ generation_id: "node-v26.13.1-el10-x86_64-20261120120000" }),
  );
  const rpmDirectory = path.join(root, "el10/x86_64/stable");
  await fs.mkdir(rpmDirectory, { recursive: true });
  for (const name of names) await fs.writeFile(path.join(rpmDirectory, name), "rpm");
  return root;
}

test("loads a candidate generation and its single RPM", async () => {
  const root = await prepareCandidate(["node.rpm", "README"]);
  const load = (file, encoding) => fs.readFile(file, encoding);
  const list = (directory) => fs.readdir(directory);
  await expect(loadReleaseRpmInput(root, { readFile: load, readdir: list })).resolves.toEqual({
    generationId: "node-v26.13.1-el10-x86_64-20261120120000",
    sourceRpmDirectory: path.join(root, "el10/x86_64/stable"),
    rpmName: "node.rpm",
  });
});

test("rejects invalid generation identifiers and non-unique RPM files", async () => {
  const root = await prepareCandidate(["node.rpm", "second.rpm"]);
  const load = (file, encoding) => fs.readFile(file, encoding);
  const list = (directory) => fs.readdir(directory);
  await expect(loadReleaseRpmInput(root, { readFile: load, readdir: list })).rejects.toThrow(
    "expected one RPM in candidate, found 2",
  );
  await fs.writeFile(path.join(root, "metadata/release-manifest.json"), JSON.stringify({}));
  await expect(loadReleaseRpmInput(root, { readFile: load, readdir: list })).rejects.toThrow(
    "candidate has an invalid generation identifier",
  );
  await fs.writeFile(
    path.join(root, "metadata/release-manifest.json"),
    JSON.stringify({ generation_id: "invalid" }),
  );
  await expect(loadReleaseRpmInput(root, { readFile: load, readdir: list })).rejects.toThrow(
    "candidate has an invalid generation identifier",
  );
});
