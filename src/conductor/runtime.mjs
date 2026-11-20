import conductorState from "./runtime/state.mjs";
import conductorRepository from "./runtime/repository.mjs";
import conductorCommands from "./runtime/commands.mjs";

export default function conductorRuntime({
  root,
  stateRoot,
  repositoryUrl,
  baseImage,
  runId,
  notifyConductor,
  commands,
}) {
  async function checkpoint(title, description, fields) {
    console.log(`[conductor] checkpoint passed: ${title}`);
    await notifyConductor({
      title,
      description,
      status: "success",
      fields: [{ name: "Run", value: runId }, ...fields],
    });
  }

  return {
    ...conductorState({ stateRoot, runId }),
    ...conductorRepository({
      repositoryUrl,
      baseImage,
      runCommand: commands.runCommand,
      runCommandCapture: commands.runCommandCapture,
    }),
    ...conductorCommands({ root, commands, runId }),
    checkpoint,
  };
}
