import { createHash } from "node:crypto";
import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const spawnSync = jest.fn();
jest.unstable_mockModule("node:fs/promises", () => fs);
jest.unstable_mockModule("node:fs", () => ({ createReadStream: fs.createReadStream }));
jest.unstable_mockModule("node:child_process", () => ({ spawnSync }));
const { default: renderCard } = await import("../../src/report/render-card.mjs");

test("renders and hashes a release card with the configured browser", async () => {
  const image = Buffer.from("rendered image");
  const imagePath = "/virtual/report/card.png";
  await fs.mkdir(path.dirname(imagePath), { recursive: true });
  process.env.CHROME_BIN = "/usr/bin/chromium";
  spawnSync.mockImplementation((command, args) => {
    fs.writeFileSync(
      args.find((argument) => argument.startsWith("--screenshot=")).slice(13),
      image,
    );
    return { status: 0, stderr: "" };
  });
  try {
    await expect(renderCard("/virtual/report/card.html", imagePath)).resolves.toBe(
      createHash("sha256").update(image).digest("hex"),
    );
    expect(spawnSync).toHaveBeenCalledWith(
      "/usr/bin/chromium",
      expect.arrayContaining(["file:///virtual/report/card.html"]),
      expect.objectContaining({ timeout: 60_000 }),
    );
  } finally {
    delete process.env.CHROME_BIN;
  }
});

test("reports browser launch and render failures", async () => {
  spawnSync.mockReturnValueOnce({ error: new Error("browser missing") });
  await expect(renderCard("card.html", "card.png", "/usr/bin/chrome")).rejects.toThrow(
    "browser missing",
  );
  spawnSync.mockReturnValueOnce({ status: 1, stderr: "render failed" });
  await expect(renderCard("card.html", "card.png", "/usr/bin/chrome")).rejects.toThrow(
    "release-card rendering failed: render failed",
  );
});
