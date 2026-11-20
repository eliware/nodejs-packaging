import { expect, test } from "@jest/globals";
import renderReleaseCardHtml from "../../src/report/html.mjs";

test("escapes report values before adding them to the release card", () => {
  const html = renderReleaseCardHtml({
    logoData: "data:image/svg+xml;base64,logo",
    status: "✓ NO UPDATES",
    statusColor: "#8fb7dc",
    details: [["Decision", `<script title="x">'&</script>`]],
    runId: `<run&1>`,
    reason: `reason "one"`,
    changed: false,
  });
  expect(html).toContain("&lt;script title=&quot;x&quot;&gt;&#39;&amp;&lt;/script&gt;");
  expect(html).toContain("Run &lt;run&amp;1&gt;");
  expect(html).toContain("reason &quot;one&quot;");
});
