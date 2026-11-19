#!/usr/bin/env node
import sourceModule from "../src/publish/release.mjs";
const { main } = sourceModule();

await main();
