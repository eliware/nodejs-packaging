import commandRunModule from "./commands/run.mjs";
import commandCaptureModule from "./commands/capture.mjs";

const { runCommand } = commandRunModule();
const { runCommandCapture } = commandCaptureModule();

export default function conductorCommandsModule() {
  return { runCommand, runCommandCapture };
}
