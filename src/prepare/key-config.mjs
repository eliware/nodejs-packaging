import { readFile } from "node:fs/promises";
import path from "node:path";

export default async function loadReleaseKeyConfig(root, read = readFile) {
  const configPath = path.join(root, "build-config/nodejs-release-keys.json");
  return JSON.parse(await read(configPath, "utf8"));
}
