# Release Notes

## 15.2.0 — 2026-11-19

### Added

- The local conductor checks the newest stable Node.js 26 release and the CentOS Stream 10 base image each day.
- The pipeline verifies the signed official Linux x64 archive before it builds an RPM.
- The RPM targets CentOS Stream 10 EPEL on x86_64 and provides the `node26`, `npm26`, and `npx26` commands.
- The pipeline signs and publishes RPM repository metadata in immutable generations with catalogs, indexes, provenance, and validation records.
- The matching CentOS Stream 10 runtime image installs the published RPM, passes a runtime check, and publishes a version-tagged image to GHCR.
- The conductor sends Discord checkpoint notifications and publishes release reports with cards.
- A systemd timer runs the conductor daily. Operators can also run discovery, archive download, build, and publication commands manually.
