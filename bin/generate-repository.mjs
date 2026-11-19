#!/usr/bin/env node
import sourceModule from "../src/generate-repository.mjs";
const { main } = sourceModule();

await main();
