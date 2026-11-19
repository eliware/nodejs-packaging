# Local release commands

Run the package and image commands on a CentOS Stream 10 x86_64 host. Install Node.js 26 or later, GnuPG, RPM tools, and Docker before a release.

The pipeline packages the official precompiled binary tarball. It does not compile Node.js.

## Run the update conductor

The systemd timer checks Node.js 26 and the CentOS Stream 10 base image each day at 8:00 AM EST. The service runs a dry-run preflight before it starts a release run.

The conductor builds and publishes a new RPM and image when Node.js has a newer stable release. It rebuilds and publishes only the image when the CentOS base digest changes. It leaves the repository unchanged when neither input changes.

Set the signing key and repository paths in the systemd unit. Load `DISCORD_WEBHOOK` from the same private environment file as the GlusterFS conductor. The conductor sends Discord messages after each passed checkpoint and after final repository commit and push.

Install the timer files and enable the timer:

```sh
sudo cp systemd/nodejs-packaging.service /etc/systemd/system/
sudo cp systemd/nodejs-packaging.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nodejs-packaging.timer
```

Run a preflight manually:

```sh
npm run conductor -- --dry-run
```

Run the complete pipeline manually:

```sh
npm run conductor -- --wet-run
```

## Prepare a release

Run the update check to print the newest stable Node.js 26 release:

```sh
npm run release:discover
```

Download the official Linux x64 tarball and signed checksum files. Verify the signature against the approved release key fingerprints. Verify the archive digest and save the release input below `.state/sources/`.

```sh
npm run release:prepare
```

## Build and publish the RPM

Build the `nodejs26` RPM from the prepared binary archive:

```sh
npm run release:rpm -- --version 26.13.1
```

Generate a repository candidate:

```sh
npm run release:repository -- --version 26.13.1
```

Set `NODEJS_SIGNING_KEY` to the Node.js release signing key fingerprint. Set `NODEJS_GNUPGHOME` when the key uses a separate GnuPG home. The default GnuPG home is `/var/lib/eliware/nodejs-signing/gnupg`.

Publish the signed repository to the mounted repository tree:

```sh
npm run release:publish -- --version 26.13.1 --candidate artifacts/repositories/<candidate> --repository /eliware/nodejs-repository
```

The publisher signs the RPM, repository metadata, and provenance. It stores an immutable generation, updates the stable repository pointer, and activates the new metadata. Keep the signing key private and outside Git.

## Build the image

Set `NODEJS_REPOSITORY_URL` to the production service root after the repository reports ready.

On CentOS Stream 10 hosts, disable AppStream when you install or update `nodejs26`. AppStream also provides a package with that name.

```sh
sudo dnf --disablerepo=appstream install nodejs26
sudo dnf --disablerepo=appstream update nodejs26
```

The image build reads the stable catalog from that service. DNF installs `nodejs26` from its signed repository metadata and verifies the RPM signature.

Build and smoke-check the `centos10-node26` image from the published repository:

```sh
NODEJS_REPOSITORY_URL=https://<production-host> npm run release:image -- --version 26.13.1
```

The RPM output goes below `artifacts/rpms/<version>/`. The local image record goes below `artifacts/images/<version>/`.

The candidate goes below `artifacts/repositories/`. The image command requires the production HTTP service and its signed RPM repository. Neither command pushes images to GHCR.
