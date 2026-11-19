#!/usr/bin/env node
import sourceModule from "../src/discover/release.mjs";
const { main } = sourceModule();

const release = await main();
process.stdout.write(`${JSON.stringify(release, null, 2)}\n`);
