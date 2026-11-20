import path from "node:path";

export default function resolveSourceDirectory(root, sourceDirectory) {
  const outputRoot = path.resolve(sourceDirectory || path.join(root, ".state/sources"));
  const outputRelative = path.relative(root, outputRoot);
  const outputIsInsideRepository =
    outputRelative === "" ||
    (outputRelative !== ".." && !outputRelative.startsWith(`..${path.sep}`));
  const outputIsIgnoredState =
    outputRelative === ".state" || outputRelative.startsWith(`.state${path.sep}`);
  if (outputIsInsideRepository && !outputIsIgnoredState)
    throw new Error("NODEJS_SOURCE_DIR must be outside the repository or under ignored .state");
  return outputRoot;
}
