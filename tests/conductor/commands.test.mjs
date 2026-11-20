import { expect, jest, test } from "@jest/globals";

const runCommand = jest.fn();
const runCommandCapture = jest.fn();
jest.unstable_mockModule("../../src/conductor/commands/run.mjs", () => ({ default: runCommand }));
jest.unstable_mockModule("../../src/conductor/commands/capture.mjs", () => ({
  default: runCommandCapture,
}));
const { default: conductorCommandsModule } = await import("../../src/conductor/commands.mjs");

test("composes inherited and captured command runners", () => {
  expect(conductorCommandsModule()).toEqual({ runCommand, runCommandCapture });
});
