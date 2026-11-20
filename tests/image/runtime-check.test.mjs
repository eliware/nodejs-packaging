import { expect, jest, test } from "@jest/globals";
import verifyImageRuntime from "../../src/image/runtime-check.mjs";

function successfulDocker() {
  return jest.fn((args) => ({
    status: 0,
    stdout: args[args.indexOf("--entrypoint") + 1] === "node" ? "v26.13.1\n" : "12.2.3\n",
    stderr: "",
  }));
}

test("checks Node.js, npm, and npx versions", () => {
  const runDocker = successfulDocker();
  expect(() =>
    verifyImageRuntime({
      runDocker,
      image: "node:26.13.1",
      version: "26.13.1",
      npmVersion: "12.2.3",
    }),
  ).not.toThrow();
  expect(runDocker).toHaveBeenCalledTimes(3);
});

test("reports Node.js and package manager runtime failures", () => {
  expect(() =>
    verifyImageRuntime({
      runDocker: () => ({ status: 1, stdout: "", stderr: "node failed" }),
      image: "node:26.13.1",
      version: "26.13.1",
      npmVersion: "12.2.3",
    }),
  ).toThrow("image runtime check failed: node failed");

  for (const command of ["npm", "npx"]) {
    const runDocker = (args) => {
      const entrypoint = args[args.indexOf("--entrypoint") + 1];
      const stdout =
        entrypoint === "node" ? "v26.13.1\n" : entrypoint === command ? "wrong\n" : "12.2.3\n";
      return { status: 0, stdout, stderr: "" };
    };
    expect(() =>
      verifyImageRuntime({
        runDocker,
        image: "node:26.13.1",
        version: "26.13.1",
        npmVersion: "12.2.3",
      }),
    ).toThrow(`${command} runtime check failed: wrong`);
  }
});
