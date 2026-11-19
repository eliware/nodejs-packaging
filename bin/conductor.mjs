#!/usr/bin/env node
import sourceModule from "../src/conductor.mjs";
const { main } = sourceModule();

await main();
