#!/usr/bin/env node
import sourceModule from "../src/rpm/build.mjs";
const { main } = sourceModule();

await main();
