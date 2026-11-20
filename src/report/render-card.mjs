import { spawnSync } from "node:child_process";
import generateFilesModule from "../generate/files.mjs";

const { hashFile } = generateFilesModule();

export default async function renderCard(
  htmlPath,
  imagePath,
  chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome",
) {
  const render = spawnSync(
    chrome,
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--window-size=1200,630",
      `--screenshot=${imagePath}`,
      `file://${htmlPath}`,
    ],
    { encoding: "utf8", timeout: 60_000 },
  );
  if (render.error) throw render.error;
  if (render.status !== 0) throw new Error(`release-card rendering failed: ${render.stderr}`);
  return hashFile(imagePath);
}
