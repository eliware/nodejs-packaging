import rpmReleaseForNpm from "../src/rpm-release.mjs";

test("advances the RPM release when the npm patch version advances", () => {
  expect(rpmReleaseForNpm("12.2.3")).toBe("1.npm12.2.3");
  expect(rpmReleaseForNpm("12.2.4")).toBe("1.npm12.2.4");
});

test("rejects unsupported npm versions for the RPM release", () => {
  expect(() => rpmReleaseForNpm("11.9.0")).toThrow(
    "npm versions must use the 12.0.0 or later format",
  );
  expect(() => rpmReleaseForNpm(undefined)).toThrow(
    "npm versions must use the 12.0.0 or later format",
  );
});
