import path from "node:path";

export default function loadImagePublicationSettings(argv, env) {
  const recordPath = path.resolve(argv[0] || "");
  if (!argv[0]) throw new Error("pass the published image record path");
  const keyFingerprint = env.NODEJS_SIGNING_KEY;
  if (!/^[A-F0-9]{40}$/.test(keyFingerprint || ""))
    throw new Error("set NODEJS_SIGNING_KEY to the signing key fingerprint");
  const repositoryRoot = path.resolve(env.NODEJS_REPOSITORY_ROOT || "/eliware/nodejs-repository");
  const gpgHome = path.resolve(env.NODEJS_GNUPGHOME || "/var/lib/eliware/nodejs-signing/gnupg");
  return { recordPath, repositoryRoot, keyFingerprint, gpgHome };
}
