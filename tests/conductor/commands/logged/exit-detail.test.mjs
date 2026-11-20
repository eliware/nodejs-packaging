import { expect, test } from "@jest/globals";
import formatExitDetail from "../../../../src/conductor/commands/logged/exit-detail.mjs";

test("formats details only for failed commands", () => {
  expect(formatExitDetail(0, "ignored warning")).toBe("");
  expect(formatExitDetail(2, "command failed")).toBe(": command failed");
});
