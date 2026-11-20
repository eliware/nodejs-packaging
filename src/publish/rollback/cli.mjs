import path from "node:path";
import rollbackGeneration from "./run.mjs";
import parseRollbackArguments from "./arguments.mjs";

export default async function rollbackRepository(
  argv = process.argv.slice(2),
  env = process.env,
  output = console,
) {
  const args = parseRollbackArguments(argv);
  const generation = args.get("generation");
  const root = path.resolve(env.NODEJS_REPOSITORY_ROOT || "/eliware/nodejs-repository");
  try {
    output.log(`Restored ${await rollbackGeneration(root, generation)}`);
  } catch (error) {
    output.error(error.message);
    process.exitCode = 1;
  }
}
