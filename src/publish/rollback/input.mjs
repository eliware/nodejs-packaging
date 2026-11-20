import path from "node:path";
import parseArguments from "../../cli/arguments.mjs";

export default function resolveRollbackInput(argv, env) {
  const args = parseArguments(argv);
  return {
    generation: args.get("generation"),
    root: path.resolve(env.NODEJS_REPOSITORY_ROOT || "/eliware/nodejs-repository"),
  };
}
