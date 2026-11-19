# Node.js release contract

This document defines the first release contract for the Node.js package service. The packaging repository owns this contract. The repository and HTTP projects consume it.

## Supported release

Package Node.js 26 releases for CentOS Stream 10 EPEL on x86_64 from the official precompiled Linux x64 tarball. Publish one stable RPM repository and optional preview repositories. Build a matching runtime image for each published release.

Read the Node.js release index from `https://nodejs.org/dist/index.json`. Select the newest stable version whose major version is 26. Treat version `26.13.1` as the initial release input. Do not hard-code it as the ongoing update source.

Download the matching precompiled Linux x64 archive and signed checksum files from the official Node.js distribution site. Use `node-v<version>-linux-x64.tar.xz` as the RPM input. Verify the detached checksum signature against trusted Node.js release key fingerprints. Verify the archive checksum before extraction. Record the selected version, source URL, archive name, archive SHA-256, checksum file, signing key fingerprint, and verification time.

Repackage the official binaries. Do not compile Node.js from source.

## Package and image targets

Use `el10/x86_64/stable/` for the stable RPM repository. Use `el10/x86_64/previews/<release-id>/` for immutable preview repositories.

Build only x86_64 RPMs for CentOS Stream 10 EPEL. Do not create Debian, Ubuntu, other RPM distribution, or other architecture outputs.

Name the RPM `nodejs26`. Install the versioned tarball under `/opt/nodejs/26/<version>/` and link `/opt/nodejs/26/current` to that directory. Provide `node26`, `npm26`, and `npx26` commands under `/usr/bin` so this package can coexist with another Node.js package.

Use the upstream Linux x64 tarball as `Source0`. Set the RPM version to the upstream Node.js version and the release to the Eliware package revision. Do not run `configure`, `make`, or a compiler during RPM construction.

Publish the runtime image as `ghcr.io/eliware/centos10-node26`. Build it from the CentOS Stream 10 base and install the matching RPM. Tag each image with the Node.js release version. Record and expose the immutable image digest.

## Publication layout

Keep these paths in each immutable generation:

| Path | Purpose |
| --- | --- |
| `el10/x86_64/stable/` | Stable RPM repository pointer |
| `el10/x86_64/previews/<release-id>/` | Immutable preview repository |
| `keys/` | Public RPM and provenance signing keys |
| `metadata/catalog.json` | Stable release, preview, and image catalog |
| `metadata/repository-index.json` | Public file and directory index |
| `metadata/release-manifest.json` | Generation manifest and artifact hashes |
| `metadata/provenance/` | Source, build, and image provenance |
| `metadata/validation/` | Package and image validation records |
| `.generations/<generation-id>/` | Immutable generation contents and evidence |

The packaging conductor owns publication. It writes a complete generation, validates it, and then switches public pointers. The HTTP service only reads published files.

## Metadata rules

Use `metadata_version` to identify the metadata schema. Keep it separate from the application version. Start with schema version `0.1.0`.

Include the channel, Node.js version, target OS, target architecture, precompiled archive URL, file name, digest, signature URL, signing fingerprint, verification time, RPM name, epoch, version, release, architecture, path, digest, validation result, provenance path, and generation identifier in every release record.

Include the image repository, version tag, immutable digest, source release, build inputs, validation result, and provenance path in every image record.

Reject missing, unknown, legacy, or newer metadata versions. Write metadata atomically. Sign RPM repository metadata, release manifests, and provenance records.

## Local pipeline boundary

Run update discovery, archive verification, RPM packaging, package checks, repository generation, signing, image builds, image checks, and publication on the packaging host.

Do not require ARC runners, remote package builders, builder images, ccache, or workflows that build packages remotely. Keep credentials and private runtime configuration outside Git.
