import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import publishFilesystemModule from "../filesystem.mjs";
import copyConductorLogs from "./logs.mjs";

const files = publishFilesystemModule();

export default function imageGeneration() {
  async function stageImageGeneration({ repositoryRoot, oldRoot, image, generated }) {
    const stamp = generated.replace(/[-:.TZ]/g, "");
    const generationId = `node-v${image.source_release}-el10-x86_64-${stamp}`;
    const stage = path.join(repositoryRoot, ".generations", `.staging-${generationId}`);
    const finalRoot = path.join(repositoryRoot, ".generations", generationId);
    if ((await files.exists(finalRoot)) || (await files.exists(stage)))
      throw new Error(`generation already exists: ${generationId}`);
    await mkdir(path.dirname(stage), { recursive: true });
    await cp(oldRoot, stage, { recursive: true });
    await copyConductorLogs(stage);
    return { generationId, stage, finalRoot };
  }

  async function cleanupImageGeneration({ stage, finalRoot, activationStarted }) {
    await rm(stage, { recursive: true, force: true });
    if (!activationStarted) await rm(finalRoot, { recursive: true, force: true });
  }

  return { stageImageGeneration, cleanupImageGeneration };
}
