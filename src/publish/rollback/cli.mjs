import rollbackGeneration from "./run.mjs";
import resolveRollbackInput from "./input.mjs";
import reportRollbackFailure from "./failure.mjs";

export default async function rollbackRepository(
  argv = process.argv.slice(2),
  env = process.env,
  output = console,
) {
  try {
    const { generation, root, keyFingerprint, gpgHome } = resolveRollbackInput(argv, env);
    output.log(
      `Restored ${await rollbackGeneration(root, generation, { keyFingerprint, gpgHome })}`,
    );
  } catch (error) {
    reportRollbackFailure(error, output);
  }
}
