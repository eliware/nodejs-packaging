#!/usr/bin/env node
import sourceModule from "../src/image/build.mjs";
const { main } = sourceModule();

await main();
