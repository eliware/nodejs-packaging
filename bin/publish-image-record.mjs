#!/usr/bin/env node
import sourceModule from "../src/publish/image/record.mjs";
const { main } = sourceModule();

await main();
