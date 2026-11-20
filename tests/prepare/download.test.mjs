import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:fs", () => ({
  createWriteStream: (file) => ({ file }),
}));
jest.unstable_mockModule("node:stream/promises", () => ({
  pipeline: async (body, output) => fs.writeFile(output.file, body),
}));
const { default: download } = await import("../../src/prepare/download.mjs");
const { default: saveDownloadedFile } = await import("../../src/prepare/download/file.mjs");

test("downloads a trusted HTTPS response through a temporary file", async () => {
  const fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    url: "https://nodejs.org/archive.tar.xz",
    body: Buffer.from("archive"),
  }));
  globalThis.fetch = fetch;
  await fs.mkdir("/virtual", { recursive: true });
  await download("https://nodejs.org/archive.tar.xz", "/virtual/archive.tar.xz", ["nodejs.org"]);
  await expect(fs.readFile("/virtual/archive.tar.xz", "utf8")).resolves.toBe("archive");
  expect(fetch).toHaveBeenCalledWith(
    "https://nodejs.org/archive.tar.xz",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});

test("rejects failed responses and URLs outside trusted HTTPS hosts", async () => {
  const dependencies = {
    fetch: jest.fn(async () => ({ ok: false, status: 503, url: "https://nodejs.org/file" })),
  };
  await expect(
    download("https://nodejs.org/file", "/virtual/file", ["nodejs.org"], dependencies),
  ).rejects.toThrow("download failed with HTTP 503");
  dependencies.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    url: "http://nodejs.org/file",
  });
  await expect(
    download("https://nodejs.org/file", "/virtual/file", ["nodejs.org"], dependencies),
  ).rejects.toThrow("download left the trusted HTTPS hosts");
  await expect(
    download("https://evil.test/file", "/virtual/file", ["nodejs.org"], dependencies),
  ).rejects.toThrow("download left the trusted HTTPS hosts");
  dependencies.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    url: "https://evil.test/file",
  });
  await expect(
    download("https://nodejs.org/file", "/virtual/file", ["nodejs.org"], dependencies),
  ).rejects.toThrow("download left the trusted HTTPS hosts");
});

test("propagates pipeline and rename failures", async () => {
  const response = { ok: true, status: 200, body: Buffer.from("file") };
  const dependencies = {
    fetch: async () => response,
    createWriteStream: () => ({}),
    pipeline: async () => {
      throw new Error("write failed");
    },
  };
  await expect(
    download("https://nodejs.org/file", "/virtual/file", ["nodejs.org"], dependencies),
  ).rejects.toThrow("write failed");
  dependencies.pipeline = async () => {};
  dependencies.rename = async () => {
    throw new Error("rename failed");
  };
  await expect(
    download("https://nodejs.org/file", "/virtual/file", ["nodejs.org"], dependencies),
  ).rejects.toThrow("rename failed");
});

test("uses separate temporary files for concurrent downloads to one destination", async () => {
  const temporaryPaths = [];
  const dependencies = {
    fetch: async (_url, options) => ({
      ok: true,
      status: 200,
      url: "https://nodejs.org/archive.tar.xz",
      body: options.signal ? Buffer.from(`archive-${temporaryPaths.length}`) : null,
    }),
    createWriteStream: (file) => {
      temporaryPaths.push(file);
      return { file };
    },
    pipeline: (body, output) => fs.writeFile(output.file, body),
  };
  await fs.mkdir("/virtual", { recursive: true });
  await Promise.all([
    download(
      "https://nodejs.org/archive.tar.xz",
      "/virtual/shared.tar.xz",
      ["nodejs.org"],
      dependencies,
    ),
    download(
      "https://nodejs.org/archive.tar.xz",
      "/virtual/shared.tar.xz",
      ["nodejs.org"],
      dependencies,
    ),
  ]);
  expect(new Set(temporaryPaths).size).toBe(2);
  await expect(fs.readFile("/virtual/shared.tar.xz", "utf8")).resolves.toMatch(/^archive-/);
  expect((await fs.readdir("/virtual")).filter((name) => name.endsWith(".part"))).toEqual([]);
});

test("uses default file operations when no dependencies are supplied", async () => {
  await fs.mkdir("/virtual", { recursive: true });
  await saveDownloadedFile(Buffer.from("default archive"), "/virtual/default-archive.tar.xz");
  await expect(fs.readFile("/virtual/default-archive.tar.xz", "utf8")).resolves.toBe(
    "default archive",
  );
});
