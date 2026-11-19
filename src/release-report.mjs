import reportGenerateModule from "./report/generate.mjs";

const { generateReleaseReport } = reportGenerateModule();

export default function moduleApi() {
  return { generateReleaseReport };
}
