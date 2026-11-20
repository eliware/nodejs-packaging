import { expect, jest, test } from "@jest/globals";
const runProcess = jest.fn(async () => ({ code: 0, stdout: "", stderr: "" }));
jest.unstable_mockModule("../../../../src/conductor/commands/process.mjs", () => ({
  default: runProcess,
}));
const { default: runLoggedCommand } =
  await import("../../../../src/conductor/commands/logged/run.mjs");

test("configures and delegates logged command execution", async () => {
  runProcess.mockClear();
  await expect(
    runLoggedCommand("node", ["--version"], {
      cwd: "/virtual/work",
      env: { TOKEN: "secret" },
      logPath: "/virtual/run.log",
      logName: "run",
    }),
  ).resolves.toEqual({ code: 0 });
  expect(runProcess).toHaveBeenCalledWith(
    "node",
    ["--version"],
    expect.objectContaining({
      cwd: "/virtual/work",
      env: { TOKEN: "secret" },
      stdio: ["ignore", "pipe", "pipe"],
      onError: expect.any(Function),
      onExit: expect.any(Function),
    }),
  );
});

test("uses the current environment when no environment is provided", async () => {
  await runLoggedCommand("node", [], { logPath: "/virtual/run.log", logName: "run" });
  expect(runProcess).toHaveBeenLastCalledWith(
    "node",
    [],
    expect.objectContaining({ env: process.env }),
  );
});
