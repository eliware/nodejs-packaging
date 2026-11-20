import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const generateCandidate = jest.fn(async ({ outputRoot, generationId }) => ({
  output: outputRoot,
  generation_id: generationId,
}));
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("../src/generate/candidate.mjs", () => ({
  default: generateCandidate,
}));
const { default: main } = await import("../src/generate-repository.mjs");

async function prepareInputs(packageDir) {
  const root = process.cwd();
  const version = "26.13.1";
  await fs.mkdir(packageDir, { recursive: true });
  await fs.writeFile(path.join(packageDir, "node.rpm"), "rpm");
  await fs.writeFile(
    path.join(packageDir, "package.json"),
    JSON.stringify({
      name: "eliware-node26",
      version,
      path: "node.rpm",
      npm_version: "12.2.3",
    }),
  );
  await fs.mkdir(path.join(root, ".state/sources", version), { recursive: true });
  await fs.writeFile(
    path.join(root, ".state/sources", version, "release-input.json"),
    JSON.stringify({
      source: {
        sha256: "a".repeat(64),
        signature_url: "https://nodejs.org/SHASUMS.sig",
        signing_key_fingerprint: "A".repeat(40),
        verified_at: "2026-11-19T12:00:00.000Z",
      },
      npm: { version: "12.2.3" },
    }),
  );
  return { root, version };
}

test("parses explicit arguments and prints the generated candidate result", async () => {
  const packageDir = "/virtual/rpm-input";
  const { root, version } = await prepareInputs(packageDir);
  const output = "/virtual/repository-output";
  const write = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    await main(["--version", version, "--rpm-dir", packageDir, "--output", output]);
    expect(generateCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        root,
        version,
        outputRoot: output,
        rpmPath: path.join(packageDir, "node.rpm"),
        rpmRecord: expect.objectContaining({ name: "eliware-node26", version }),
        sourceInput: expect.objectContaining({
          source: expect.objectContaining({ sha256: "a".repeat(64) }),
        }),
      }),
    );
    expect(JSON.parse(write.mock.calls[0][0])).toEqual(
      expect.objectContaining({ output, generation_id: expect.any(String) }),
    );
  } finally {
    write.mockRestore();
  }
});

test("uses default paths and rejects unsupported release versions", async () => {
  await expect(main()).rejects.toThrow("pass a stable Node.js 26 version with --version");
  const { root, version } = await prepareInputs(path.join(process.cwd(), "artifacts/rpms/26.13.1"));
  const write = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    await main(["--version", version]);
    const candidate = generateCandidate.mock.calls.at(-1)[0];
    expect(candidate.rpmPath).toBe(path.join(root, "artifacts/rpms", version, "node.rpm"));
    expect(candidate.outputRoot).toContain(path.join("artifacts", "repositories"));
    await fs.writeFile(
      path.join(root, "artifacts/rpms", version, "package.json"),
      JSON.stringify({ name: "wrong", version }),
    );
    await expect(main(["--version", version])).rejects.toThrow(
      "RPM record does not match the requested Node.js version",
    );
    await expect(main(["--version", "27.0.0"])).rejects.toThrow(
      "pass a stable Node.js 26 version with --version",
    );
  } finally {
    write.mockRestore();
  }
});
