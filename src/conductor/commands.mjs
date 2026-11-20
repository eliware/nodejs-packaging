import runCommand from "./commands/run.mjs";
import runCommandCapture from "./commands/capture.mjs";

export default function conductorCommandsModule() {
  return { runCommand, runCommandCapture };
}
