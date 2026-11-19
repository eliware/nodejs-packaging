import path from "node:path";

function conductorCommands({ root, commands }) {
  const { runCommand, runCommandCapture } = commands;

  async function runNode(script, args = [], extraEnv = {}) {
    return runCommand(process.execPath, [path.join(root, script), ...args], {
      cwd: root,
      env: { ...process.env, ...extraEnv },
    });
  }

  async function runNodeCapture(script, args = []) {
    return runCommandCapture(process.execPath, [path.join(root, script), ...args], { cwd: root });
  }

  return { runNode, runNodeCapture };
}

export default function conductorCommandsModule() {
  return { conductorCommands };
}
