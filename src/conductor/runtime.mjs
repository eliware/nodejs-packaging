import runtimeStateModule from "./runtime/state.mjs";
import runtimeRepositoryModule from "./runtime/repository.mjs";
import runtimeCommandsModule from "./runtime/commands.mjs";

const { conductorState } = runtimeStateModule();
const { conductorRepository } = runtimeRepositoryModule();
const { conductorCommands } = runtimeCommandsModule();

function conductorRuntime({
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
    ...conductorCommands({ root, commands }),
    checkpoint,
  };
}

export default function conductorRuntimeModule() {
  return { conductorRuntime };
}
