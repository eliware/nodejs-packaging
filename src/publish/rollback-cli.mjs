import path from "node:path";
import rollbackGeneration from "./rollback.mjs";

export default async function rollbackRepository(
  argv = process.argv.slice(2),
  env = process.env,
  output = console,
) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith("--")) args.set(argv[index].slice(2), argv[index + 1]);
  }
  const generation = args.get("generation");
  const root = path.resolve(env.NODEJS_REPOSITORY_ROOT || "/eliware/nodejs-repository");
  try {
    output.log(`Restored ${await rollbackGeneration(root, generation)}`);
  } catch (error) {
    output.error(error.message);
    process.exitCode = 1;
  }
}
