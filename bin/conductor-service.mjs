import { spawn } from "node:child_process";
import { notifyConductor } from "./discord-notifier.mjs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const conductor = path.join(root, "bin/conductor.mjs");
let phase = "dry-run";
try {
  console.log("[conductor-service] starting dry-run preflight");
  await run("--dry-run");
  phase = "wet-run";
  console.log("[conductor-service] dry-run passed. Starting wet-run.");
  await run("--wet-run");
  console.log("[conductor-service] wet-run completed");
} catch (error) {
  console.error(`[conductor-service] ${phase} failed: ${error.message}`);
  await notifyConductor({
    title: `Node.js conductor ${phase} failed`,
    description:
      phase === "dry-run"
        ? "The preflight failed. The release run did not start."
        : "The release run stopped after preflight.",
    status: "failure",
    fields: [
      { name: "Phase", value: phase },
      { name: "Error", value: error.message },
    ],
  });
  process.exitCode = 1;
}

function run(mode) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [conductor, mode], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`conductor exited with code ${code ?? "signal"} ${signal || ""}`)),
    );
  });
}
