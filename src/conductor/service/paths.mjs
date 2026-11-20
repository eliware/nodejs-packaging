import path from "node:path";
import { fileURLToPath } from "node:url";

export default function resolveServicePaths(entrypointUrl) {
  const root = path.resolve(path.dirname(fileURLToPath(entrypointUrl)), "../../..");
  return { root, conductor: path.join(root, "bin/conductor.mjs") };
}
