import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { expect, jest, test } from "@jest/globals";
import collectProcessOutput from "../../../src/conductor/commands/output.mjs";

test("collects child streams and dispatches each chunk", () => {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  const onStdout = jest.fn();
  const onStderr = jest.fn();
  const output = collectProcessOutput(child, onStdout, onStderr);
  child.stdout.write("out");
  child.stderr.write("err");
  expect(output).toEqual({ stdout: "out", stderr: "err" });
  expect(onStdout).toHaveBeenCalledWith("out");
  expect(onStderr).toHaveBeenCalledWith("err");
});

test("returns empty output when child streams are inherited", () => {
  expect(collectProcessOutput(new EventEmitter(), jest.fn(), jest.fn())).toEqual({
    stdout: "",
    stderr: "",
  });
});
