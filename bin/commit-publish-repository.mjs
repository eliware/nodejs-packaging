#!/usr/bin/env node
import sourceModule from "../src/commit-publish-repository.mjs";
const { main } = sourceModule();

await main();
