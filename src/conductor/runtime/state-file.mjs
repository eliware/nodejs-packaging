import { randomUUID } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export default async function saveConductorState(stateRoot, value, operations = {}) {
  const write = operations.writeFile || writeFile;
  const move = operations.rename || rename;
  const file = path.join(stateRoot, "last-run.json");
  const temporary = `${file}.tmp-${randomUUID()}`;
  try {
    await write(
      temporary,
      `${JSON.stringify({ ...value, updated: new Date().toISOString() }, null, 2)}\n`,
    );
    await move(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}
