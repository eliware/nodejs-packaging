import pointerOperations from "./pointer.mjs";
import fileOperations from "./files.mjs";
import writeJson from "./json.mjs";

export default function publishFilesystem() {
  return { ...pointerOperations(), ...fileOperations(), writeJson };
}
