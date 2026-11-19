# Local release guide

This guide covers packaging host setup, release commands, runtime configuration, and RPM use.
The [release contract](RELEASE-CONTRACT.md) defines the authoritative build and publication rules.

## Requirements

Run the pipeline on a CentOS Stream 10 x86_64 host. Install Node.js 26 or later and npm 12 or later.
Install Docker, GnuPG, RPM build tools, `createrepo_c`, and Google Chrome.

The pipeline packages the official Node.js Linux x64 binary archive. It does not compile Node.js from source.
The packaging host needs network access to Node.js, npm, CentOS, and the configured repository application.

## Development and validation

Run `npm test` for Jest tests, lint, format, dependency, and Eliware convention checks.
Run `npm test -- tests/conductor.test.mjs` to run one focused test file.
Run `npm test -- tests/conductor.test.mjs tests/prepare-release.test.mjs` to run multiple test files.
Run `npm run lint`, `npm run format:check`, or `npm run audit` to run one validation stage.
Run `npm run format` to format maintained files.

## Install and configure

Run `npm ci` from the repository root. Configure the signing key and repository access before a wet run.
Keep the private key, webhook URL, and registry credentials outside Git.

Set these environment variables when their defaults do not match the host:

| Variable                           | Default                                       | Requirement and use                                                        |
| ---------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| `NODEJS_REPOSITORY_URL`            | `https://nodejs.eliware.org`                  | Optional. Use the HTTPS root of the repository application.                |
| `NODEJS_REPOSITORY_ROOT`           | `/eliware/nodejs-repository`                  | Optional. Set the local repository data path.                              |
| `NODEJS_SIGNING_KEY`               | None                                          | Required for publication. Set the 40-character signing key fingerprint.    |
| `NODEJS_GNUPGHOME`                 | `/var/lib/eliware/nodejs-signing/gnupg`       | Optional. Set the GnuPG home that contains the private signing key.        |
| `NODEJS_SOURCE_DIR`                | `.state/sources` in this checkout             | Optional. Set the verified source archive cache path.                      |
| `NODEJS_CONDUCTOR_STATE_ROOT`      | `/var/lib/eliware/nodejs-packaging/conductor` | Optional. Set the conductor lock and state path.                           |
| `CHROME_BIN`                       | `/usr/bin/google-chrome`                      | Optional. Set the Chrome executable used to create release cards.          |
| `CONDUCTOR_DISCORD_WEBHOOK`        | None                                          | Required for wet conductor runs when `DISCORD_WEBHOOK` is unset.           |
| `DISCORD_WEBHOOK`                  | None                                          | Required for wet conductor runs when `CONDUCTOR_DISCORD_WEBHOOK` is unset. |
| `NODEJS_REPOSITORY_GIT_REMOTE`     | `origin`                                      | Optional. Set the Git remote for the repository data push.                 |
| `NODEJS_REPOSITORY_GIT_BRANCH`     | `main`                                        | Optional. Set the target branch for the repository data push.              |
| `NODEJS_REPOSITORY_GIT_USER_NAME`  | `Eliware`                                     | Optional. Set the commit author name for repository data.                  |
| `NODEJS_REPOSITORY_GIT_USER_EMAIL` | `nodejs-release@eliware.org`                  | Optional. Set the commit author email for repository data.                 |

The systemd unit sets repository, signing, state, and Chrome values in its unit file.
The unit reads webhook values from `/etc/gluster-packaging/release.env`.

## Run the conductor

Run one mode at a time from the repository root:

```sh
npm run conductor -- --dry-run
npm run conductor -- --wet-run
```

The dry run checks the newest stable Node.js 26 release, npm latest, and the CentOS Stream 10 base image digest.
It reports if a build is needed without publishing artifacts.
The wet run requires a Discord webhook and starts release work when an input changed.

The conductor builds an RPM and image when Node.js or npm changes. It reuses the published RPM when only the base image changes.
It skips builds when all three inputs match the published release.
It sends Discord messages after passed checkpoints and after the release finishes.

The systemd timer starts daily at 13:00 UTC. This is 8:00 AM Eastern Standard Time and 9:00 AM Eastern Daylight Time.
The unit runs a dry-run preflight before the wet run.

Install and enable the timer:

```sh
sudo cp systemd/nodejs-packaging.service /etc/systemd/system/
sudo cp systemd/nodejs-packaging.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nodejs-packaging.timer
```

Check the timer and unit with `systemctl list-timers nodejs-packaging.timer` and `systemctl status nodejs-packaging.service`.
Read unit logs with `journalctl -u nodejs-packaging.service`.

## Run release commands manually

Find the newest stable Node.js 26 release:

```sh
npm run release:discover
```

Download and verify the Node.js archive and npm package. The prepare command defaults to the newest stable Node.js 26 and npm latest.

```sh
npm run release:prepare
```

Pass `--version 26.x.y` to select a Node.js release. Pass `--npm-version x.y.z` to select an npm version.
Pass `--allow-older true` only when you must prepare an older stable Node.js 26 release.

Build an RPM from the verified release input:

```sh
npm run release:rpm -- --version 26.x.y
```

Pass `--release-input PATH` to use a release input at a different path. Pass `--output PATH` to set the RPM output directory.
The default output directory is `artifacts/rpms/<version>/`.

Create a repository candidate:

```sh
npm run release:repository -- --version 26.x.y
```

Pass `--rpm-dir PATH` to select the RPM record directory. Pass `--output PATH` to select the candidate output path.
The default candidate path is under `artifacts/repositories/`.

Publish the candidate to the mounted repository:

```sh
npm run release:publish -- --version 26.x.y --candidate PATH --repository /eliware/nodejs-repository
```

Set `NODEJS_SIGNING_KEY` and, when needed, `NODEJS_GNUPGHOME` before publication.
The publisher signs the RPM, repository metadata, release manifest, and provenance.
It activates a complete immutable generation after validation.

Commit and push changed repository data with the standalone launcher `node bin/commit-publish-repository.mjs`.

## Install and use the RPM

Configure the signed repository, then install the package:

```sh
sudo yum -y install eliware-node26
sudo yum -y update
```

The RPM provides `node`, `npm`, and `npx`. It replaces CentOS AppStream `nodejs26` during installation.
The package installs Node.js under `/opt/nodejs/26/<version>/` and links `/opt/nodejs/26/current` to the active version.

The RPM keeps npm updates and global package data under `/var/lib/eliware/nodejs26/global`.
It adds that directory's `bin` folder and npm prefix through `/etc/profile.d/eliware-nodejs26.sh`.
Run `npm -g install npm@latest` to update npm without changing RPM-owned files.
Run `npm link` from a local package repository to add its commands to the global prefix.

## Build the runtime image

Set `NODEJS_REPOSITORY_URL` to the HTTPS root for the Node.js HTTP application.
Build and smoke-check the local image:

```sh
NODEJS_REPOSITORY_URL=https://nodejs.eliware.org npm run release:image -- --version 26.x.y
```

Add `--push` to publish the image to GHCR. The build checks Node.js, npm, and npx before it pushes the image.
The command writes image details to `artifacts/images/<version>/image.json`.

Publish an image record after the repository has published the matching Node.js release:

```sh
npm run release:record-image -- artifacts/images/<version>/image.json
```

Set `NODEJS_SIGNING_KEY` and, when needed, `NODEJS_GNUPGHOME` before this command.
The image record must include a passed runtime check and a registry digest.

The RPM record is written to `artifacts/rpms/<version>/`. Repository candidates are written to `artifacts/repositories/`.

## Troubleshooting

Check network access to `nodejs.org`, npm, and the repository application when discovery or downloads fail.
Check the configured GnuPG home, private key, and fingerprint when signing fails.
Check Docker access and GHCR login when an image build or push fails.
Check the systemd environment file and webhook value when a wet conductor run fails during preflight.

## Security

Keep signing keys, webhook URLs, registry credentials, and runtime state outside Git.
Keep published repository files read-only for the Node.js HTTP application.
