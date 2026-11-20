#!/usr/bin/env node
import createConductorConfig from "./config.mjs";
import runConductor from "../conductor.mjs";

export default async function main(argv = process.argv.slice(2), env = process.env) {
  await runConductor(createConductorConfig(argv, env));
}
