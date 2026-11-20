import { expect, test } from "@jest/globals";
import generateReleaseReport from "../src/report/generate.mjs";
import releaseReport from "../src/release-report.mjs";

test("exports the report generator from the release-report entrypoint", () => {
  expect(releaseReport).toBe(generateReleaseReport);
});
