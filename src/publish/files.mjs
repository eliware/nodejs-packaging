import atomicCopy from "./files/copy.mjs";
import hashFile from "./files/hash.mjs";
import listFiles from "./files/list.mjs";

export default function fileOperations() {
  return { atomicCopy, hashFile, listFiles };
}
