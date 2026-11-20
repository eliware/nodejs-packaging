import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export default async function publishReportRecord({ reportPath, report }) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}
