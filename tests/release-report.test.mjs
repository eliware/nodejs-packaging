import path from "node:path";
import { Readable } from "node:stream";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
const spawnSync = jest.fn();
jest.unstable_mockModule("node:fs/promises", () => ({
  ...fs,
  copyFile: (source, destination) => fs.cp(source, destination),
}));
jest.unstable_mockModule("node:fs", () => ({
  createReadStream: () => Readable.from([Buffer.from("image bytes")]),
}));
jest.unstable_mockModule("node:child_process", () => ({ spawnSync }));
const { default: reportModule } = await import("../src/release-report.mjs");
const { escapeHtml, generateReleaseReport } = reportModule();

async function setup() {
  const root = process.cwd();
  await fs.mkdir(path.join(root, "assets"), { recursive: true });
  await fs.writeFile(path.join(root, "assets/eliware-brand.svg"), "<svg>logo</svg>");
  spawnSync.mockReset();
  spawnSync.mockImplementation((command, args) => {
    const screenshot = args.find((arg) => arg.startsWith("--screenshot="))?.slice(13);
    fs.writeFileSync(screenshot, "image bytes");
    return { status: 0 };
  });
  return root;
}

test("escapes HTML content for release reports", () => {
  expect(escapeHtml(`<script title="x">'&</script>`)).toBe(
    "&lt;script title=&quot;x&quot;&gt;&#39;&amp;&lt;/script&gt;",
  );
  expect(escapeHtml(null)).toBe("");
});

test("writes a no-update report, release card, and latest pointers", async () => {
  await setup();
  process.env.NODEJS_REPOSITORY_URL = "https://reports.example.test";
  try {
    const result = await generateReleaseReport({
      runId: "run-1",
      repositoryRoot: "/virtual/repository",
      nodeVersion: "26.13.1",
      npmVersion: "12.2.3",
      baseDigest: "sha256:base",
      imageDigest: "sha256:image",
      imageId: "sha256:id",
      rpmSha256: "a".repeat(64),
      reason: "No updates & current",
      changed: false,
    });
    const report = JSON.parse(await fs.readFile(result.reportPath, "utf8"));
    const html = await fs.readFile(
      result.htmlPath || path.join(path.dirname(result.reportPath), "release-card.html"),
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
      await fs.readFile("/virtual/repository/metadata/latest-release-report.json", "utf8"),
    ).toContain("run-1");
    expect(await fs.readFile("/virtual/repository/metadata/latest-release-card.png")).toEqual(
      Buffer.from("image bytes"),
    );
    expect(spawnSync).toHaveBeenCalledWith(
      "/usr/bin/google-chrome",
      expect.any(Array),
      expect.any(Object),
    );
  } finally {
    delete process.env.NODEJS_REPOSITORY_URL;
  }
});

test("writes a completed release card and honors the configured browser", async () => {
  await setup();
  process.env.CHROME_BIN = "/usr/bin/chromium";
  delete process.env.NODEJS_REPOSITORY_URL;
  try {
    const result = await generateReleaseReport({
      runId: "run-2",
      repositoryRoot: "/virtual/repository-2",
      nodeVersion: "26.13.1",
      npmVersion: "12.2.3",
      baseDigest: "sha256:base",
      reason: "Node.js update",
      changed: true,
    });
    const report = JSON.parse(await fs.readFile(result.reportPath, "utf8"));
    expect(report.status).toBe("certified");
    expect(report.card.png).toContain("https://nodejs.eliware.org/");
    expect(report.image_digest).toBeNull();
    expect(report.image_id).toBeNull();
    expect(report.rpm_sha256).toBeNull();
    expect(
      await fs.readFile(path.join(path.dirname(result.reportPath), "release-card.html"), "utf8"),
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
    generateReleaseReport({
      runId: "run-3",
      repositoryRoot: "/virtual/repository-3",
      changed: false,
      reason: "current",
    }),
  ).rejects.toThrow("browser missing");
  spawnSync.mockReturnValueOnce({ status: 1, stderr: "render failed" });
  await expect(
    generateReleaseReport({
      runId: "run-4",
      repositoryRoot: "/virtual/repository-4",
      changed: false,
      reason: "current",
    }),
  ).rejects.toThrow("release-card rendering failed: render failed");
});
