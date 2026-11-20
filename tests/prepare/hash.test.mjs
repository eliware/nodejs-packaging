import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { expect, jest, test } from "@jest/globals";

const content = Buffer.from("default stream");
jest.unstable_mockModule("node:fs", () => ({
  createReadStream: () => Readable.from([content]),
}));
const { default: hashFile } = await import("../../src/prepare/hash.mjs");

test("hashes streamed file contents with the requested digest format", async () => {
  const content = Buffer.from("release archive");
  const open = () => Readable.from([content.subarray(0, 7), content.subarray(7)]);
  await expect(hashFile("archive", "sha256", "hex", open)).resolves.toBe(
    createHash("sha256").update(content).digest("hex"),
  );
  await expect(hashFile("archive", "sha512", "base64", open)).resolves.toBe(
    createHash("sha512").update(content).digest("base64"),
  );
});

test("propagates stream errors", async () => {
  const open = () =>
    Readable.from({
      async *[Symbol.asyncIterator]() {
        yield Buffer.from("partial");
        throw new Error("read failed");
      },
    });
  await expect(hashFile("archive", "sha256", "hex", open)).rejects.toThrow("read failed");
});

test("uses the default file stream and digest format", async () => {
  await expect(hashFile("archive")).resolves.toBe(
    createHash("sha256").update(content).digest("hex"),
  );
});
