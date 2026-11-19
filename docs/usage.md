# Local release guide

Run these commands on a CentOS Stream 10 x86_64 host. Install Node.js 26, npm 12, GnuPG, RPM tools, Docker, and Google Chrome.

The pipeline packages the official Node.js binary tarball. It does not compile Node.js from source.

## Run the conductor

The systemd timer checks Node.js 26, npm@latest, and the CentOS Stream 10 base image every day at 8:00 AM EST.
The unit runs a dry-run check before it starts a wet release run.

If Node.js or npm has a newer stable release, the conductor builds and publishes an RPM and image.
If only the base image changes, the conductor reuses the RPM and publishes an image.
If all three inputs match the published release, the conductor skips builds and repository changes.

The unit loads `DISCORD_WEBHOOK` from `/etc/gluster-packaging/release.env`.
The conductor sends a Discord message after each passed checkpoint.
The conductor sends a final status with a release card after it commits and pushes repository data.

Install and enable the timer:

```sh
sudo cp systemd/nodejs-packaging.service /etc/systemd/system/
sudo cp systemd/nodejs-packaging.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nodejs-packaging.timer
```

Run a dry-run check:

```sh
npm run conductor -- --dry-run
```

Run a wet release:

```sh
npm run conductor -- --wet-run
```

## Prepare an RPM

Check the latest stable Node.js 26 release:

```sh
npm run release:discover
```

Download the official Linux x64 tarball, signed checksum, signature, and approved public keys.
The prepare command verifies the signature and archive digest.

```sh
npm run release:prepare
```

Build the `eliware-node26` RPM from the verified Node.js archive and npm package:

```sh
npm run release:rpm -- --version 26.13.1
```

Create a repository candidate:

```sh
npm run release:repository -- --version 26.13.1
```

Set `NODEJS_SIGNING_KEY` to the release key fingerprint. Set `NODEJS_GNUPGHOME` to a separate key home when needed.
The default key home is `/var/lib/eliware/nodejs-signing/gnupg`.

Publish a signed candidate to the mounted repository:

```sh
npm run release:publish -- --version 26.13.1 --candidate artifacts/repositories/<candidate> --repository /eliware/nodejs-repository
```

The publisher signs the RPM, repository metadata, and provenance. It activates an immutable generation after it validates the candidate.
Keep the private signing key outside Git.

## Install the RPM

Install the Eliware package from the signed repository:

```sh
sudo yum -y install eliware-node26
sudo yum -y update
```

The RPM provides the standard `node`, `npm`, and `npx` commands. It includes npm 12 or later and replaces CentOS AppStream `nodejs26` during installation.
It keeps npm updates, global packages, and linked repositories under `/var/lib/eliware/nodejs26/global`.
The RPM adds that directory's `bin` folder and npm prefix through `/etc/profile.d/eliware-nodejs26.sh`.
The RPM release includes the bundled npm version so `yum check-update` detects npm-only updates.

Run `npm -g install npm@latest` to update npm without changing RPM-owned files.
Run `npm link` from a local package repository to add its commands to the global prefix.

## Build the image

Set `NODEJS_REPOSITORY_URL` to the HTTPS root for the Node.js HTTP application. It defaults to `https://nodejs.eliware.org`.

Build and smoke-check a local `centos10-node26` image:

```sh
NODEJS_REPOSITORY_URL=https://nodejs.eliware.org npm run release:image -- --version 26.13.1
```

Add `--push` to publish the image to GHCR. The conductor pushes the image after its smoke check passes.

The RPM record is written to `artifacts/rpms/<version>/`. The image record is written to `artifacts/images/<version>/`.
Repository candidates are written to `artifacts/repositories/`.
