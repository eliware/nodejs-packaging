# Node.js release contract

This document defines the Node.js 26 RPM and image release rules. The packaging repository owns package builds, signing, metadata, and publication.

## Source release

Read the official release index at `https://nodejs.org/dist/index.json`. Select its newest stable Node.js 26 release.

Use the official `node-v<version>-linux-x64.tar.xz` archive. Verify its signed checksum before you build an RPM.
Record the upstream version, archive URL, archive name, SHA-256 digest, signature URL, signing key fingerprint, and verification time.
Repackage the official binaries. Do not compile Node.js from source.

## RPM target

Build only x86_64 RPMs for CentOS Stream 10 EPEL. Name the RPM `eliware-node26`.

Install the versioned archive under `/opt/nodejs/26/<version>/`. Link `/opt/nodejs/26/current` to that version directory.
Provide `node`, `npm`, and `npx` commands under `/usr/bin`.
Obsolete the conflicting CentOS AppStream `nodejs26` package during installation.
Obsolete the previous `eliware-nodejs26` package during upgrade.

Include npm 12 or later in the same RPM as the initial npm command.
Keep npm updates and global package data under `/var/lib/eliware/nodejs26/global`.

Set the RPM version to the upstream Node.js version. Set its release to the Eliware package revision.
Use the package name `eliware-node26` so DNF can distinguish it from CentOS AppStream `nodejs26`.
Include the bundled npm version in the RPM release so DNF detects npm-only updates.

Use the upstream Linux x64 archive as `Source0`. Do not run `configure`, `make`, or a compiler during RPM construction.

## Runtime image

Publish `ghcr.io/eliware/centos10-node26` with the Node.js version tag. Build from `quay.io/centos/centos:stream10`.
Install the matching signed RPM. Run a Node.js version check before the image push.
Record the image tag, registry digest, source release, base image digest, validation result, and provenance path.

## Repository layout

Store the stable RPM repository under `el10/x86_64/stable/`. Store public signing keys under `keys/`.

Store the release catalog, repository index, manifest, provenance, and validation records under `metadata/`.
Store each immutable publication generation under `.generations/<generation-id>/`.
Keep the active generation and the six most recently modified generations. Prune older generations only after the new generation becomes active.
Keep `preview.available` set to `false` in the catalog. Do not publish preview paths or pointers.

To restore a retained generation, run `npm run repository:rollback -- --generation <generation-id>` on the packaging host. The command verifies the signed release manifest before it restores repository pointers.

For an interrupted publication, keep the active generation unchanged. Remove the incomplete `.staging-*` directory, then rerun the release command. Do not edit published metadata by hand.
Publish a complete generation before you set the active generation pointer. The Node.js HTTP application reads published files only.

## Metadata rules

Use `metadata_version` for the metadata schema. Use schema version `0.1.0`.
Include source, package, target, validation, provenance, and generation fields in every release record.
Include the image repository, tag, digest, base image digest, validation result, and provenance path in every image record.

Reject missing or unsupported metadata versions. Write metadata atomically.
Sign RPM files, RPM repository metadata, release manifests, and provenance records.

## Local pipeline

Check the Node.js release, npm@latest, and the CentOS base digest once each day.
Build an RPM and image when Node.js or npm has a newer version.
Use the published RPM when only the CentOS base digest changes.
Skip release work when all three inputs match the published release.

Run archive verification, RPM packaging, package checks, repository generation, signing, image builds, image checks, and publication on the packaging host.

Do not use GitHub Actions to build Node.js RPMs. Keep signing keys and webhook values outside Git.
