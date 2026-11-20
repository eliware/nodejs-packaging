import { expect, jest, test } from "@jest/globals";
import writeImagePublicationOutput from "../../../src/publish/image/output.mjs";

test("writes a formatted image publication result", () => {
  const output = { write: jest.fn() };
  const image = { tag: "26.13.1", digest: "sha256:image" };
  writeImagePublicationOutput({ generationId: "generation-1", image, output });
  expect(output.write).toHaveBeenCalledWith(
    '{\n  "generation": "generation-1",\n  "image": {\n    "tag": "26.13.1",\n    "digest": "sha256:image"\n  }\n}\n',
  );
});
