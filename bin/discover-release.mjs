#!/usr/bin/env node
import discoverReleaseCommand from "../src/discover/cli.mjs";

process.stdout.write(await discoverReleaseCommand());
