export default function validateGenerationId(generation) {
  if (!/^node-v26\.[0-9]+\.[0-9]+-el10-x86_64-[0-9]+$/.test(generation || ""))
    throw new Error("pass a retained stable generation identifier");
  return generation;
}
