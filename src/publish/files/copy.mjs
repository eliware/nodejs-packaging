import { cp, rename } from "node:fs/promises";

export default async function atomicCopy(source, destination) {
  const temporary = `${destination}.tmp-${process.pid}`;
  await cp(source, temporary);
  await rename(temporary, destination);
}
