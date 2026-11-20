import download from "./download.mjs";

export default async function downloadReleaseInputs({
  release,
  npmRelease,
  archivePath,
  checksumsPath,
  signaturePath,
  npmArchivePath,
  keyringPath,
  downloadFile = download,
}) {
  await downloadFile(release.source.url, archivePath, ["nodejs.org", "raw.githubusercontent.com"]);
  await downloadFile(release.source.checksums_url, checksumsPath, [
    "nodejs.org",
    "raw.githubusercontent.com",
  ]);
  await downloadFile(release.source.signature_url, signaturePath, [
    "nodejs.org",
    "raw.githubusercontent.com",
  ]);
  await downloadFile(npmRelease.url, npmArchivePath, ["registry.npmjs.org"]);
  await downloadFile(
    "https://raw.githubusercontent.com/nodejs/release-keys/main/gpg-only-active-keys/pubring.kbx",
    keyringPath,
    ["nodejs.org", "raw.githubusercontent.com"],
  );
}
