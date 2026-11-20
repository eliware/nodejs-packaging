import filesystemModule from "../filesystem.mjs";
import activateGeneration from "../activate-generation.mjs";
import verifyGenerationSignature from "./verify-signature.mjs";
import validateGeneration from "./validate-generation.mjs";

const files = filesystemModule();
export default async function rollbackGeneration(repositoryRoot, generation, dependencies = {}) {
  const { root, manifest, signature } = await validateGeneration(
    repositoryRoot,
    generation,
    dependencies.readFile,
    { hashFile: dependencies.hashFile, lstat: dependencies.lstat },
  );
  verifyGenerationSignature(signature, manifest, {
    gpgHome: dependencies.gpgHome,
    keyFingerprint: dependencies.keyFingerprint,
    run: dependencies.verify,
  });
  await (dependencies.activate || activateGeneration)({
    repositoryRoot,
    generationRoot: root,
    files: dependencies.files || files,
    rootFiles: [
      { source: "keys/RPM-GPG-KEY-ELIWARE-NODEJS", destination: "keys/RPM-GPG-KEY-ELIWARE-NODEJS" },
      { source: "nodejs26.repo", destination: "nodejs26.repo" },
    ],
  });
  return generation;
}
