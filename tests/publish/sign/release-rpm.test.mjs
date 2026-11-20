import { expect, jest, test } from "@jest/globals";
import signReleaseRpm from "../../../src/publish/sign/release-rpm.mjs";

test("signs the release RPM with the configured key", async () => {
  const run = jest.fn(async () => ({}));
  await signReleaseRpm({
    rpmPath: "/repository/eliware-node26.rpm",
    keyFingerprint: "A".repeat(40),
    gpgHome: "/keys",
    run,
  });
  expect(run).toHaveBeenCalledWith(
    "rpmsign",
    ["--addsign", "--define", `_gpg_name ${"A".repeat(40)}`, "/repository/eliware-node26.rpm"],
    { GNUPGHOME: "/keys" },
  );
});
