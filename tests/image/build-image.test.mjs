import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import buildImage from "../../src/image/build-image.mjs";

test("builds the versioned image with pinned release inputs", () => {
  const runDocker = jest.fn();
  buildImage({
    runDocker,
    root: "/virtual/project",
    version: "26.13.1",
    sourceInput: { source: { sha256: "a".repeat(64) } },
    repositoryBase: "https://nodejs.example",
    generationId: "generation-1",
    image: "ghcr.io/eliware/nodejs:26.13.1",
    baseDigest: `quay.io/centos/centos@sha256:${"b".repeat(64)}`,
    context: "/virtual/context",
  });
  expect(runDocker).toHaveBeenCalledWith(
    [
      "build",
      "--file",
      path.join("/virtual/project", "containers/centos10-node26.Dockerfile"),
      "--build-arg",
      "NODE_VERSION=26.13.1",
      "--build-arg",
      `SOURCE_SHA256=${"a".repeat(64)}`,
      "--build-arg",
      `BASE_IMAGE_DIGEST=sha256:${"b".repeat(64)}`,
      "--build-arg",
      "NODEJS_REPOSITORY_URL=https://nodejs.example",
      "--build-arg",
      "REPOSITORY_GENERATION=generation-1",
      "--tag",
      "ghcr.io/eliware/nodejs:26.13.1",
      "/virtual/context",
    ],
    { stdio: "inherit" },
  );
});
