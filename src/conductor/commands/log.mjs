import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export default async function writeCommandLog({ file, name, stdout = "", stderr = "" }) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    `Command: ${name}\n\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}\n`,
  );
  return { stdout, stderr };
}
