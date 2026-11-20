import { expect, jest, test } from "@jest/globals";
import saveDownloadedFile from "../../../src/prepare/download/file.mjs";

function dependencies(overrides = {}) {
  return {
    createWriteStream: jest.fn((file, options) => ({ file, options })),
    pipeline: jest.fn(async () => {}),
    rename: jest.fn(async () => {}),
    rm: jest.fn(async () => {}),
    ...overrides,
  };
}

test("writes to a private temporary file and atomically renames it", async () => {
  const deps = dependencies();
  await saveDownloadedFile(Buffer.from("archive"), "/var/cache/archive.tar.xz", deps);
  const temporaryPath = deps.createWriteStream.mock.calls[0][0];
  expect(temporaryPath).toMatch(/^\/var\/cache\/archive\.tar\.xz\..+\.part$/);
  expect(deps.createWriteStream).toHaveBeenCalledWith(temporaryPath, { mode: 0o600 });
  expect(deps.pipeline).toHaveBeenCalledWith(Buffer.from("archive"), {
    file: temporaryPath,
    options: { mode: 0o600 },
  });
  expect(deps.rename).toHaveBeenCalledWith(temporaryPath, "/var/cache/archive.tar.xz");
  expect(deps.rm).toHaveBeenCalledWith(temporaryPath, { force: true });
});

test("cleans temporary files after a transfer failure", async () => {
  const deps = dependencies({
    pipeline: jest.fn(async () => {
      throw new Error("write failed");
    }),
  });
  await expect(saveDownloadedFile(Buffer.from("archive"), "/cache/file", deps)).rejects.toThrow(
    "write failed",
  );
  expect(deps.rm).toHaveBeenCalledWith(deps.createWriteStream.mock.calls[0][0], { force: true });
});
