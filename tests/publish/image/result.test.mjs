import { expect, jest, test } from "@jest/globals";
import writeImagePublicationOutput from "../../../src/publish/image/result.mjs";

test("writes a formatted image publication result", () => {
  const output = { write: jest.fn() };
  const image = { tag: "26.13.1", digest: "sha256:image" };
  writeImagePublicationOutput({ generationId: "generation-1", image, output });
  expect(output.write).toHaveBeenCalledWith(
    '{\n  "generation": "generation-1",\n  "image": {\n    "tag": "26.13.1",\n    "digest": "sha256:image"\n  }\n}\n',
  );
});

test("writes to standard output by default", () => {
  const write = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    writeImagePublicationOutput({ generationId: "generation-2", image: { tag: "26.13.2" } });
    expect(write).toHaveBeenCalledWith(
      '{\n  "generation": "generation-2",\n  "image": {\n    "tag": "26.13.2"\n  }\n}\n',
    );
  } finally {
    write.mockRestore();
  }
});
