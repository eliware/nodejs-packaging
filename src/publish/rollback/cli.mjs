import rollbackGeneration from "./run.mjs";
import resolveRollbackInput from "./input.mjs";
import reportRollbackFailure from "./failure.mjs";

export default async function rollbackRepository(
  argv = process.argv.slice(2),
  env = process.env,
  output = console,
) {
  const { generation, root } = resolveRollbackInput(argv, env);
  try {
    output.log(`Restored ${await rollbackGeneration(root, generation)}`);
  } catch (error) {
    reportRollbackFailure(error, output);
  }
}
