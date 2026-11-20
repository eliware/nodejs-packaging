import { writeFile } from "node:fs/promises";

export default async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}
