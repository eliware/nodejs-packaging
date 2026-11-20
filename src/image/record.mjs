import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export default async function writeImageRecord(outputDir, record) {
  await mkdir(outputDir, { recursive: true });
  const recordPath = path.join(outputDir, "image.json");
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
  return recordPath;
}
