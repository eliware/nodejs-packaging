import { rename, writeFile } from "node:fs/promises";
import path from "node:path";

export default async function saveConductorState(stateRoot, value, operations = {}) {
  const write = operations.writeFile || writeFile;
  const move = operations.rename || rename;
  const file = path.join(stateRoot, "last-run.json");
  const temporary = `${file}.tmp`;
  await write(
    temporary,
    `${JSON.stringify({ ...value, updated: new Date().toISOString() }, null, 2)}\n`,
  );
  await move(temporary, file);
}
