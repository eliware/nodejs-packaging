import { expect, jest, test } from "@jest/globals";
import conductorRuntime from "../../src/conductor/runtime.mjs";

test("composes runtime helpers and reports checkpoints", async () => {
  const notifyConductor = jest.fn(async () => {});
  const commands = {
    runCommand: jest.fn(async () => ({ code: 0 })),
    runCommandCapture: jest.fn(async () => ({ code: 0, stdout: "", stderr: "" })),
  };
  const runtime = conductorRuntime({
    root: "/workspace",
    stateRoot: "/state",
    repositoryUrl: "https://nodejs.eliware.org",
    baseImage: "quay.io/centos/centos:stream10",
    runId: "run-1",
    notifyConductor,
    commands,
  });
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  try {
    await runtime.checkpoint("Passed", "Done", [{ name: "Stage", value: "test" }]);
    expect(log).toHaveBeenCalledWith("[conductor] checkpoint passed: Passed");
    expect(notifyConductor).toHaveBeenCalledWith({
      title: "Passed",
      description: "Done",
      status: "success",
      fields: [
        { name: "Run", value: "run-1" },
        { name: "Stage", value: "test" },
      ],
    });
    expect(runtime).toEqual(
      expect.objectContaining({
        acquireLock: expect.any(Function),
        getJson: expect.any(Function),
        getBaseImageDigest: expect.any(Function),
        runNode: expect.any(Function),
        runNodeCapture: expect.any(Function),
      }),
    );
  } finally {
    log.mockRestore();
  }
});
