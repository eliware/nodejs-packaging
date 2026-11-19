import path from "node:path";
import { expect, jest, test } from "@jest/globals";
import memoryFilesystemFixture from "../../test-fixtures/memory-fs.mjs";

const { createMemoryFs } = memoryFilesystemFixture();
const fs = createMemoryFs();
jest.unstable_mockModule("node:fs/promises", () => fs);
const { default: imageRecordModule } = await import("../../src/image/record.mjs");
const { writeImageRecord } = imageRecordModule();

test("writes the validated image record to its output directory", async () => {
  const outputDir = "/virtual/image-record";
  const output = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const record = { repository: "ghcr.io/eliware/node", digest: `sha256:${"a".repeat(64)}` };
  try {
    await expect(writeImageRecord(outputDir, record)).resolves.toBe(
      path.join(outputDir, "image.json"),
    );
    expect(JSON.parse(await fs.readFile(path.join(outputDir, "image.json"), "utf8"))).toEqual(
      record,
    );
    expect(output).toHaveBeenCalledWith(JSON.stringify(record, null, 2) + "\n");
  } finally {
    output.mockRestore();
  }
});
