const supportedNpmVersion = /^(1[2-9]|[2-9]\d+)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export default function rpmReleaseForNpm(version) {
  if (!supportedNpmVersion.test(version || ""))
    throw new Error("npm versions must use the 12.0.0 or later format");
  return `1.npm${version}`;
}
