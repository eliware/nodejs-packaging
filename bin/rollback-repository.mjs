#!/usr/bin/env node
import path from "node:path";
import rollbackGeneration from "../src/publish/rollback.mjs";
const args = process.argv.slice(2);
const generation = args[args.indexOf("--generation") + 1];
const root = path.resolve(process.env.NODEJS_REPOSITORY_ROOT || "/eliware/nodejs-repository");
try {
  console.log(`Restored ${await rollbackGeneration(root, generation)}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
