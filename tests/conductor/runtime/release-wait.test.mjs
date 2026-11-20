import { expect, jest, test } from "@jest/globals";
import waitForPublishedRelease from "../../../src/conductor/runtime/release-wait.mjs";

const context = { repositoryUrl: "https://nodejs.example", getJson: jest.fn() };

test("waits until both published versions match", async () => {
  context.getJson.mockResolvedValue({
    stable: { latest: { node_version: "26.13.1", npm: { version: "12.2.3" } } },
  });
  await expect(waitForPublishedRelease(context, "26.13.1", "12.2.3")).resolves.toBeUndefined();
  expect(context.getJson).toHaveBeenCalledWith(
    "https://nodejs.example/metadata/catalog.json?version=26.13.1&attempt=0",
  );
});

test("retries mismatched and failed catalog responses until timeout", async () => {
  jest.useFakeTimers();
  try {
    context.getJson.mockResolvedValue({ stable: { latest: { node_version: "26.13.0" } } });
    const mismatch = waitForPublishedRelease(context, "26.13.1", "12.2.3");
    const mismatchError = expect(mismatch).rejects.toThrow("after 60 seconds");
    await jest.advanceTimersByTimeAsync(60_000);
    await mismatchError;
    context.getJson.mockClear();
    context.getJson.mockRejectedValue(new Error("offline"));
    const failed = waitForPublishedRelease(context, "26.13.1", "12.2.3");
    const failedError = expect(failed).rejects.toThrow("after 60 seconds");
    await jest.advanceTimersByTimeAsync(60_000);
    await failedError;
    expect(context.getJson).toHaveBeenCalledTimes(30);
  } finally {
    jest.useRealTimers();
  }
});
