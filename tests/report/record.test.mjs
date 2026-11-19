import { expect, test } from "@jest/globals";
import reportRecordModule from "../../src/report/record.mjs";

const { createReportDetails, createReportRecord } = reportRecordModule();

test("builds card details for changed and unchanged release inputs", () => {
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

test("builds a complete report record with a fixed timestamp", () => {
  const result = createReportRecord({
    runId: "run-1",
    nodeVersion: "26.13.1",
    npmVersion: "12.2.3",
    baseDigest: "sha256:base",
    imageDigest: null,
    imageId: null,
    rpmSha256: null,
    reason: "No updates",
    changed: false,
    baseUrl: "https://nodejs.example",
    imageSha256: "card-hash",
    now: new Date("2026-11-19T12:00:00.000Z"),
  });
  expect(result.cardUrl).toBe("https://nodejs.example/metadata/runs/run-1/release-card.png");
  expect(result.report).toEqual(
    expect.objectContaining({
      status: "no_updates",
      generated: "2026-11-19T12:00:00.000Z",
      image_digest: null,
      image_id: null,
      rpm_sha256: null,
      card: expect.objectContaining({ sha256: "card-hash", width: 1200, height: 630 }),
    }),
  );
});
