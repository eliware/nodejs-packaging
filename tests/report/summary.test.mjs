import { expect, test } from "@jest/globals";
import createReportSummary from "../../src/report/summary.mjs";

const input = {
  nodeVersion: "26.13.1",
  npmVersion: "12.2.3",
  baseDigest: "sha256:base",
  imageDigest: "sha256:image",
  rpmSha256: "a".repeat(64),
  reason: "Node.js update",
};

test("summarizes a completed release", () => {
  expect(createReportSummary({ ...input, changed: true })).toMatchObject({
    status: "✓ RELEASE COMPLETE",
    statusColor: "#55d68a",
  });
});

test("summarizes a run without updates", () => {
  expect(createReportSummary({ ...input, changed: false })).toMatchObject({
    status: "✓ NO UPDATES",
    statusColor: "#8fb7dc",
  });
});
