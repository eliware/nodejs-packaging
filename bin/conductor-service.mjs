#!/usr/bin/env node
import sourceModule from "../src/conductor/service.mjs";
const { main } = sourceModule();

await main();
