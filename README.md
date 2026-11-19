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

The conductor checks Node.js 26, npm@latest, and CentOS Stream 10 base-image updates. It packages official Node.js x64 tarballs with npm 12 or later as signed RPMs.

It rebuilds the RPM and image when Node.js or npm changes. It reuses the published RPM when only the CentOS base image changes.
It does no release work when all three inputs match the published release. It commits release records to `nodejs-repository`.

## Requirements

Use Node.js 26 or later and npm 12 or later. Install Docker, GnuPG, RPM tools, `createrepo_c`, and Google Chrome on the packaging host.

## Setup

Run `npm ci` from the repository root. Provision the Node.js signing key and private environment file before a wet conductor run.

## Usage

Read the [local release guide](docs/README.md) and [release notes](RELEASE_NOTES.md). Read the [specifications index](specs/README.md) before changing release contracts.

## Development

Read [AGENTS.md](AGENTS.md) before changing files. Keep build inputs, release records, and publication data with their owning repository.

## Testing

Run `npm test` to run Jest tests, lint checks, format checks, dependency checks, and Eliware conventions.

Run focused tests with `npm test -- tests/conductor-plan.test.mjs`.

## Troubleshooting

If the upstream index cannot be reached, check network access to `nodejs.org`. If package signing fails, check the GnuPG home and key fingerprint.

If GHCR rejects an image push, refresh the host login and check package write access.

## Security

Keep signing keys, webhook URLs, and registry credentials outside Git. Keep repository files read-only for the Node.js HTTP application.

## Configuration

Set `NODEJS_REPOSITORY_URL` to the HTTPS website root. It defaults to `https://nodejs.eliware.org`.

Set `NODEJS_REPOSITORY_ROOT` to the repository data path. It defaults to `/eliware/nodejs-repository`.
Set `NODEJS_SIGNING_KEY` to the release key fingerprint. Wet runs require this value.

Set `NODEJS_GNUPGHOME` to the signing key home. It defaults to `/var/lib/eliware/nodejs-signing/gnupg`.
Set `NODEJS_SOURCE_DIR` to the archive cache. It defaults to `.state/sources` in this checkout.

Set `NODEJS_CONDUCTOR_STATE_ROOT` to the lock and run-state path. It defaults to `/var/lib/eliware/nodejs-packaging/conductor`.
Set `CHROME_BIN` to the Chrome executable. It defaults to `/usr/bin/google-chrome`.

Set `CONDUCTOR_DISCORD_WEBHOOK` or `DISCORD_WEBHOOK` to the Discord webhook URL. Wet runs require one of these values.
Set `NODEJS_REPOSITORY_GIT_REMOTE` to the Git remote. It defaults to `origin`.

Set `NODEJS_REPOSITORY_GIT_BRANCH` to the target branch. It defaults to `main`.
Set `NODEJS_REPOSITORY_GIT_USER_NAME` and `NODEJS_REPOSITORY_GIT_USER_EMAIL` to the commit identity. They default to `Eliware` and `nodejs-release@eliware.org`.

## Operations

Install the systemd files from `systemd/` and enable `nodejs-packaging.timer` for its daily 8:00 AM EST run.
The timer checks Node.js, npm, and the CentOS base image together.
Run `npm run conductor -- --dry-run` to check upstream inputs without publishing artifacts. Run `npm run conductor -- --wet-run` to complete a release.
The conductor sends Discord messages after each passed checkpoint and sends a final report with the release card.

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
