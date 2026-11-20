import { expect, test } from "@jest/globals";
import createReportDetails from "../../src/report/details.mjs";

test("builds display details for changed and unchanged release inputs", () => {
  expect(
    createReportDetails({
      nodeVersion: "26.13.1",
      npmVersion: "12.2.3",
      baseDigest: "sha256:base",
      imageDigest: null,
      rpmSha256: null,
      reason: "No updates",
    }),
  ).toEqual([
    ["Node.js", "v26.13.1"],
    ["npm", "12.2.3"],
    ["Base image", "sha256:base"],
    ["Container", "ghcr.io/eliware/centos10-node26@not rebuilt"],
    ["RPM SHA-256", "unchanged"],
    ["Decision", "No updates"],
  ]);
});
