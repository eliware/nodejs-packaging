import path from "node:path";
import parseReleaseArguments from "./arguments.mjs";

export default function loadReleaseInput(argv, environment = process.env) {
  const args = parseReleaseArguments(argv);
  const version = args.get("version");
  const candidateRoot = path.resolve(args.get("candidate") || "");
  const repositoryRoot = path.resolve(
    args.get("repository") || environment.NODEJS_REPOSITORY_ROOT || "/eliware/nodejs-repository",
  );
  const keyFingerprint = environment.NODEJS_SIGNING_KEY;
  const gpgHome = path.resolve(
    environment.NODEJS_GNUPGHOME || "/var/lib/eliware/nodejs-signing/gnupg",
  );
  if (!/^26\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version || ""))
    throw new Error("pass a stable Node.js 26 version with --version");
  if (!args.get("candidate")) throw new Error("pass a repository candidate with --candidate");
  if (!/^[A-F0-9]{40}$/.test(keyFingerprint || ""))
    throw new Error("set NODEJS_SIGNING_KEY to the signing key fingerprint");
  return { version, candidateRoot, repositoryRoot, keyFingerprint, gpgHome };
}
