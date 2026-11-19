import { expect, jest, test } from "@jest/globals";
import imagePublishModule from "../../src/image/publish.mjs";

const { publishImage } = imagePublishModule();
const digest = `sha256:${"a".repeat(64)}`;

test("pushes an image, reports output, and returns its registry digest", async () => {
  const run = jest.fn(() => ({
    status: 0,
    stdout: `pushed\ndigest: ${digest}`,
    stderr: "complete",
  }));
  const stdout = { write: jest.fn() };
  const stderr = { write: jest.fn() };
  await expect(publishImage("ghcr.io/eliware/node:26", run, stdout, stderr)).resolves.toBe(digest);
  expect(run).toHaveBeenCalledWith(
    "docker",
    ["push", "ghcr.io/eliware/node:26"],
    expect.objectContaining({ maxBuffer: 10 * 1024 * 1024 }),
  );
  expect(stdout.write).toHaveBeenCalledWith(`pushed\ndigest: ${digest}`);
  expect(stderr.write).toHaveBeenCalledWith("complete");
});

test("finds a digest in stderr and handles empty output streams", async () => {
  await expect(
    publishImage(
      "image",
      () => ({ status: 0, stdout: "", stderr: `digest: ${digest}` }),
      {
        write: jest.fn(),
      },
      { write: jest.fn() },
    ),
  ).resolves.toBe(digest);
});

test("reports Docker launch, push, and digest failures", async () => {
  const failure = new Error("docker missing");
  const output = { write: jest.fn() };
  await expect(publishImage("image", () => ({ error: failure }), output, output)).rejects.toBe(
    failure,
  );
  await expect(
    publishImage("image", () => ({ status: 1, stdout: "", stderr: "failed" }), output, output),
  ).rejects.toThrow("docker push exited with status 1");
  await expect(
    publishImage("image", () => ({ status: 0, stdout: "", stderr: "" }), output, output),
  ).rejects.toThrow("docker push completed without reporting an image digest");
});
