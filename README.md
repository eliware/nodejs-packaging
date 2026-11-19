# Node.js packaging

This repository packages and publishes the official precompiled Node.js 26 Linux x64 binaries as `nodejs26` RPMs and `centos10-node26` images for CentOS Stream 10 EPEL.

The release pipeline runs on the local packaging host. It checks for Node.js updates, verifies the official binary archive, packages and validates RPMs, signs repository data, builds and validates the runtime image, and publishes release records.

The release pipeline publishes content to [nodejs-repository](https://github.com/eliware/nodejs-repository). The read-only website and HTTP service live in [nodejs-http](https://github.com/eliware/nodejs-http).

Read the [release contract](specs/release-contract.md) before changing package, image, publication, or metadata behavior.

Read [local release commands](docs/usage.md) to prepare and build local artifacts.
