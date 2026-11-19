# [![eliware.org](https://eliware.org/logos/brand.png)](https://discord.gg/M6aTR9eTwN)

## @eliware/nodejs-packaging [![License](https://img.shields.io/github/license/eliware/nodejs-packaging)](https://github.com/eliware/nodejs-packaging/blob/main/LICENSE) [![CI](https://github.com/eliware/nodejs-packaging/actions/workflows/ci.yaml/badge.svg)](https://github.com/eliware/nodejs-packaging/actions/workflows/ci.yaml)

Reproducible Node.js package builds, signed repositories, runtime images, and release provenance.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Setup](#setup)
- [Usage](#usage)
- [Development](#development)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Configuration](#configuration)
- [Operations](#operations)
- [Support](#support)
- [Links](#links)
- [License](#license)

## Features

The conductor checks stable Node.js 26, npm, and the CentOS Stream 10 base image. It packages official Node.js x64 binaries as signed RPMs.

It builds an RPM and image when Node.js or npm changes. It reuses the RPM when only the base image changes.
It skips release work when all checked inputs match the published release.

## Requirements

Use Node.js 26 or later and npm 12 or later. Install Docker, GnuPG, RPM tools, `createrepo_c`, and Google Chrome on the packaging host.

## Setup

Run `npm ci` from the repository root. Provision the signing key and private environment file before a wet conductor run.

## Usage

Read the [local release guide](docs/usage.md) for setup, package installation, conductor runs, and configuration.
Browse the [documentation index](docs/README.md) for maintained guides.
Read the [release contract](docs/RELEASE-CONTRACT.md) for authoritative release rules.
Read the [specifications index](specs/README.md) before changing repository contracts.
Read the [release notes](RELEASE_NOTES.md) for user-visible changes.

## Development

Read [AGENTS.md](AGENTS.md) before changing files. Keep build inputs and release records with their owning repository.

## Testing

Run `npm test` for tests, lint checks, format checks, dependency checks, and Eliware conventions.
Run `npm test -- tests/conductor.test.mjs` to run one focused test file.

## Troubleshooting

Check network access to `nodejs.org` when release discovery fails. Check the GnuPG home and key fingerprint when package signing fails.
Refresh the host login and check package write access when GHCR rejects an image push.

## Security

Keep signing keys, webhook URLs, and registry credentials outside Git. Keep repository files read-only for the Node.js HTTP application.

## Configuration

Set runtime, signing, and Git values through the environment. Read [configuration details](docs/usage.md#install-and-configure) for names, defaults, and requirements.

## Operations

Install the files in `systemd/` and enable the daily timer. Run `npm run conductor -- --dry-run` to check inputs.
Run `npm run conductor -- --wet-run` to publish a release when inputs changed. Read the [operations guide](docs/usage.md#run-the-conductor) for details.

## Support

For help, questions, or to chat with the author and community, visit:

[![Discord](https://eliware.org/logos/discord_96.png)](https://discord.gg/M6aTR9eTwN)[![eliware.org](https://eliware.org/logos/eliware_96.png)](https://discord.gg/M6aTR9eTwN)

**[eliware.org on Discord](https://discord.gg/M6aTR9eTwN)**

## Links

- [Home Page](https://eliware.org)
- [GitHub Org](https://github.com/eliware)
- [GitHub Repo](https://github.com/eliware/nodejs-packaging)
- [Bug Reports](https://github.com/eliware/nodejs-packaging/issues)
- [Discord](https://discord.gg/M6aTR9eTwN)

## License

[MIT © Eliware](LICENSE)
