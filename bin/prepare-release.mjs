#!/usr/bin/env node
import sourceModule from "../src/prepare-release.mjs";
const { main } = sourceModule();

await main();
