import path from "node:path";
import { Readable } from "node:stream";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const spawnSync = jest.fn();
jest.unstable_mockModule("node:fs/promises", () => ({
  ...fs,
  copyFile: (source, destination) => fs.cp(source, destination),
}));
jest.unstable_mockModule("node:fs", () => ({
  createReadStream: (file) =>
    Readable.from(
      (async function* () {
        yield await fs.readFile(file);
      })(),
    ),
}));
jest.unstable_mockModule("node:child_process", () => ({ spawnSync }));
const { default: generateReleaseReport } = await import("../../src/report/generate.mjs");

async function setup() {
  const root = process.cwd();
  await fs.mkdir(path.join(root, "assets"), { recursive: true });
  await fs.writeFile(path.join(root, "assets/eliware-brand.svg"), "<svg>logo</svg>");
  spawnSync.mockReset();
  spawnSync.mockImplementation((command, args) => {
    const screenshot = args.find((arg) => arg.startsWith("--screenshot="))?.slice(13);
    fs.writeFileSync(screenshot, "image bytes");
    return { status: 0, stderr: "" };
  });
}

function reportInput(overrides = {}) {
  return {
    runId: "run-1",
    repositoryRoot: "/virtual/report-generation",
    nodeVersion: "26.13.1",
    npmVersion: "12.2.3",
    baseDigest: "sha256:base",
    imageDigest: "sha256:image",
    imageId: "sha256:id",
    rpmSha256: "a".repeat(64),
    reason: "Node.js update",
    changed: true,
    ...overrides,
  };
}

test("publishes a no-update report and updates the latest card pointers", async () => {
  await setup();
  process.env.NODEJS_REPOSITORY_URL = "https://reports.example.test";
  try {
    const result = await generateReleaseReport(
      reportInput({ changed: false, reason: "No updates & current" }),
    );
    const report = JSON.parse(await fs.readFile(result.reportPath, "utf8"));
    const html = await fs.readFile(
      result.imagePath.replace(/release-card\.png$/, "release-card.html"),
      "utf8",
    );
    expect(report).toMatchObject({
      status: "no_updates",
      node_version: "26.13.1",
      card: {
        png: "https://reports.example.test/metadata/runs/run-1/release-card.png",
        sha256: expect.any(String),
      },
    });
    expect(html).toContain("NO UPDATES");
    expect(html).toContain("No updates &amp; current");
    expect(
      await fs.readFile("/virtual/report-generation/metadata/latest-release-report.json", "utf8"),
    ).toContain("run-1");
    await expect(
      fs.readFile("/virtual/report-generation/metadata/latest-release-card.png"),
    ).resolves.toEqual(Buffer.from("image bytes"));
    expect(spawnSync).toHaveBeenCalledWith(
      "/usr/bin/google-chrome",
      expect.any(Array),
      expect.any(Object),
    );
  } finally {
    delete process.env.NODEJS_REPOSITORY_URL;
  }
});

test("publishes a completed release report and honors the configured browser", async () => {
  await setup();
  process.env.CHROME_BIN = "/usr/bin/chromium";
  delete process.env.NODEJS_REPOSITORY_URL;
  try {
    const result = await generateReleaseReport(reportInput({ runId: "run-2", changed: true }));
    const report = JSON.parse(await fs.readFile(result.reportPath, "utf8"));
    expect(report.status).toBe("certified");
    expect(report.card.png).toContain("https://nodejs.eliware.org/");
    expect(report.image_digest).toBe("sha256:image");
    expect(report.image_id).toBe("sha256:id");
    expect(report.rpm_sha256).toBe("a".repeat(64));
    expect(
      await fs.readFile(
        result.imagePath.replace(/release-card\.png$/, "release-card.html"),
        "utf8",
      ),
    ).toContain("RELEASE COMPLETE");
    expect(spawnSync).toHaveBeenCalledWith(
      "/usr/bin/chromium",
      expect.any(Array),
      expect.any(Object),
    );
  } finally {
    delete process.env.CHROME_BIN;
  }
});

test("reports browser startup and rendering failures", async () => {
  await setup();
  spawnSync.mockReturnValueOnce({ error: new Error("browser missing") });
  await expect(
    generateReleaseReport(reportInput({ runId: "run-3", changed: false, reason: "current" })),
  ).rejects.toThrow("browser missing");
  spawnSync.mockReturnValueOnce({ status: 1, stderr: "render failed" });
  await expect(
    generateReleaseReport(reportInput({ runId: "run-4", changed: false, reason: "current" })),
  ).rejects.toThrow("release-card rendering failed: render failed");
});
