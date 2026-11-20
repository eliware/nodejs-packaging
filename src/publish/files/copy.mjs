import { randomUUID } from "node:crypto";
import { cp, rename, rm } from "node:fs/promises";

export default async function atomicCopy(source, destination) {
  const temporary = `${destination}.tmp-${randomUUID()}`;
  try {
    await cp(source, temporary);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
