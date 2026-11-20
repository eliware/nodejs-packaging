import { expect, test } from "@jest/globals";
import captureOutput from "../../../../../src/conductor/commands/logged/capture/output.mjs";

test("creates command capture callbacks", () => {
  expect(captureOutput({ quiet: true })).toEqual(
    expect.objectContaining({
      onStdout: expect.any(Function),
      onStderr: expect.any(Function),
      onError: expect.any(Function),
      onExit: expect.any(Function),
    }),
  );
});
