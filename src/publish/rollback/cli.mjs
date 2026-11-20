import path from "node:path";
import rollbackGeneration from "./run.mjs";
import parseArguments from "../../cli/arguments.mjs";
import reportRollbackFailure from "./failure.mjs";

export default async function rollbackRepository(
  argv = process.argv.slice(2),
  env = process.env,
  output = console,
) {
  const args = parseArguments(argv);
  const generation = args.get("generation");
  const root = path.resolve(env.NODEJS_REPOSITORY_ROOT || "/eliware/nodejs-repository");
  try {
    output.log(`Restored ${await rollbackGeneration(root, generation)}`);
  } catch (error) {
    reportRollbackFailure(error, output);
  }
}
