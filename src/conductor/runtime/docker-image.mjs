import getBaseImageDigest from "../../image/base-image.mjs";

export default function conductorDockerImage({ baseImage, runCommand, runCommandCapture }) {
  return {
    getBaseImageDigest: () => getBaseImageDigest({ baseImage, runCommand, runCommandCapture }),
  };
}
