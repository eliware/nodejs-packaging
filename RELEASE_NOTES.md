# Release Notes

## 15.2.0 — 2026-11-19

### Added

- Add a local conductor that checks Node.js 26 and the CentOS Stream 10 base image.
- Check npm@latest with each conductor run and create an updated RPM and image when npm changes.
- Include npm 12 or later in the Node.js RPM and keep global npm data outside RPM files.
- Name the RPM `eliware-node26` and provide standard `node`, `npm`, and `npx` commands.
- Package the official precompiled Node.js x64 archive as a signed RPM.
- Build and publish the CentOS Stream 10 Node.js runtime image.
- Add signed repository generations, image provenance, and release cards.
- Add Discord checkpoint notifications and a daily 8:00 AM EST systemd timer.
