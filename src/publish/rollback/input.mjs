import path from "node:path";
import parseArguments from "../../cli/arguments.mjs";
import validateGenerationId from "./generation-id.mjs";

export default function resolveRollbackInput(argv, env) {
  const args = parseArguments(argv);
  const generation = validateGenerationId(args.get("generation"));
  const keyFingerprint = env.NODEJS_SIGNING_KEY;
  if (!/^[A-F0-9]{40}$/.test(keyFingerprint || ""))
    throw new Error("set NODEJS_SIGNING_KEY to the trusted release signing fingerprint");
  return {
    generation,
    keyFingerprint,
    gpgHome: path.resolve(env.NODEJS_GNUPGHOME || "/var/lib/eliware/nodejs-signing/gnupg"),
    root: path.resolve(env.NODEJS_REPOSITORY_ROOT || "/eliware/nodejs-repository"),
  };
}
