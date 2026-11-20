# Release Notes

## 15.2.0 — 2026-11-19

### Added

- The pipeline discovers the newest stable Node.js 26 release and npm version.
- The daily conductor checks the Node.js release, npm version, and CentOS Stream 10 base image.
- The RPM packages the official precompiled Node.js x64 archive for CentOS Stream 10 EPEL on x86_64.
- The RPM includes npm 12 or later and provides the `node`, `npm`, and `npx` commands.
- The package keeps npm updates and global package data outside RPM-owned files.
- The pipeline signs RPMs, repository metadata, release manifests, and provenance records.
- The repository publishes immutable generations with release catalogs, indexes, and validation records.
- The runtime image uses the matching RPM and runs checks for Node.js, npm, and npx.
- The image publisher records its registry digest, base image digest, validation result, and provenance.
- The conductor sends Discord checkpoint messages and creates release reports with cards.
- The systemd timer runs the conductor daily. Operators can also run discovery, source checks, build, and publication commands manually.
