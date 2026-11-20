import { expect, test } from "@jest/globals";
import resolveRepositoryUrl from "../../src/image/repository-url.mjs";

test("uses the production URL by default and honors an override", () => {
  expect(resolveRepositoryUrl()).toBe(
    process.env.NODEJS_REPOSITORY_URL || "https://nodejs.eliware.org",
  );
  expect(resolveRepositoryUrl({})).toBe("https://nodejs.eliware.org");
  expect(resolveRepositoryUrl({ NODEJS_REPOSITORY_URL: "https://repo.example" })).toBe(
    "https://repo.example",
  );
});
