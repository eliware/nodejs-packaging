import path from "node:path";
import { expect, test } from "@jest/globals";
import conductorConfigModule from "../../src/conductor/config.mjs";

const { createConductorConfig } = conductorConfigModule();

test("builds an isolated dry-run context with defaults", () => {
  const config = createConductorConfig(["--dry-run"], {}, "/workspace");
  expect(config).toEqual({
    root: "/workspace",
    repositoryRoot: path.resolve("/eliware/nodejs-repository"),
    repositoryUrl: "https://nodejs.eliware.org",
    baseImage: "quay.io/centos/centos:stream10",
    dryRun: true,
    stateRoot: path.resolve("/var/lib/eliware/nodejs-packaging/conductor"),
    lockPath: path.resolve("/var/lib/eliware/nodejs-packaging/conductor/lock"),
    runId: expect.stringMatching(/^\d+-[a-f\d]{8}$/),
  });
});

test("derives the project root from its source module", () => {
  expect(createConductorConfig(["--dry-run"], {}).root).toBe(path.resolve(process.cwd()));
});

test("uses configured wet-run paths and rejects unsupported modes", () => {
  expect(
    createConductorConfig(
      ["--wet-run"],
      {
        NODEJS_REPOSITORY_ROOT: "/srv/repository",
        NODEJS_REPOSITORY_URL: "https://repo.example.test/",
        NODEJS_CONDUCTOR_STATE_ROOT: "/srv/workspace/conductor",
      },
      "/workspace",
    ),
  ).toEqual(
    expect.objectContaining({
      repositoryRoot: "/srv/repository",
      repositoryUrl: "https://repo.example.test",
      stateRoot: "/srv/workspace/conductor",
      lockPath: "/srv/workspace/conductor/lock",
      dryRun: false,
    }),
  );
  expect(() => createConductorConfig(["--resume"], {}, "/workspace")).toThrow(
    "choose exactly one conductor mode: --dry-run or --wet-run",
  );
});
