import createReportDetails from "./details.mjs";

export default function createReportSummary(input) {
  const { changed } = input;
  return {
    status: changed ? "✓ RELEASE COMPLETE" : "✓ NO UPDATES",
    statusColor: changed ? "#55d68a" : "#8fb7dc",
    details: createReportDetails(input),
  };
}
