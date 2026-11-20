export default async function signReleaseRpm({ rpmPath, keyFingerprint, gpgHome, run }) {
  await run("rpmsign", ["--addsign", "--define", `_gpg_name ${keyFingerprint}`, rpmPath], {
    GNUPGHOME: gpgHome,
  });
}
