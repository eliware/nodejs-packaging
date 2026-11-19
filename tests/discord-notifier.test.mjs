import { jest, test } from "@jest/globals";
const sendMessage = jest.fn();
const log = { warn: jest.fn() };
jest.unstable_mockModule("@eliware/common", () => ({ log }));
jest.unstable_mockModule("@eliware/discord-webhook", () => ({ sendMessage }));
const { default: sourceModule } = await import("../src/discord-notifier.mjs");
const { createConductorEmbed, getWebhookUrl, hasDiscordWebhook, notifyConductor } = sourceModule();

test("prefers the conductor webhook setting", () => {
  expect(
    getWebhookUrl({
      CONDUCTOR_DISCORD_WEBHOOK: "https://example.test/hook",
      DISCORD_WEBHOOK: "fallback",
    }),
  ).toBe("https://example.test/hook");
  expect(hasDiscordWebhook({ DISCORD_WEBHOOK: "https://example.test/hook" })).toBe(true);
  expect(getWebhookUrl({ DISCORD_WEBHOOK: "fallback" })).toBe("fallback");
  expect(hasDiscordWebhook({})).toBe(false);
  const saved = process.env.DISCORD_WEBHOOK;
  process.env.DISCORD_WEBHOOK = "https://example.test/default";
  expect(getWebhookUrl()).toBe("https://example.test/default");
  expect(hasDiscordWebhook()).toBe(true);
  if (saved === undefined) delete process.env.DISCORD_WEBHOOK;
  else process.env.DISCORD_WEBHOOK = saved;
});

test("limits embed fields and includes the release card image", () => {
  const embed = createConductorEmbed(
    {
      title: "Release",
      description: "Complete",
      status: "success",
      fields: Array.from({ length: 30 }, (_, index) => ({ name: `${index}`, value: "ok" })),
      cardUrl: "https://example.test/card.png",
    },
    "2026-11-19T00:00:00.000Z",
  );

  expect(embed.fields).toHaveLength(25);
  expect(embed.image).toEqual({ url: "https://example.test/card.png" });
  expect(embed.timestamp).toBe("2026-11-19T00:00:00.000Z");
});

test("skips delivery when no webhook is configured", async () => {
  const sent = [];
  const result = await notifyConductor(
    { title: "Release", description: "Complete" },
    { env: {}, sendMessage: async (message) => sent.push(message) },
  );

  expect(result).toBe(false);
  expect(sent).toEqual([]);
  await expect(notifyConductor({ title: "Release", description: "Complete" })).resolves.toBe(false);
});

test("builds bounded embeds with defaults and fallback status", () => {
  const embed = createConductorEmbed({
    title: "t".repeat(300),
    description: "d".repeat(4200),
    status: "unknown",
    fields: [{ name: "n".repeat(300), value: "", inline: false }],
  });

  expect(embed.title).toHaveLength(256);
  expect(embed.description).toHaveLength(4096);
  expect(embed.color).toBe(0x3498db);
  expect(embed.fields).toEqual([{ name: "n".repeat(256), value: "—", inline: false }]);
  expect(embed.image).toBeUndefined();
  expect(embed.timestamp).toEqual(expect.any(String));
});

test("sends an embed and returns true after a successful webhook response", async () => {
  const sent = [];
  await expect(
    notifyConductor(
      { title: "Release", description: "Complete" },
      {
        env: { CONDUCTOR_DISCORD_WEBHOOK: "https://example.test/hook" },
        now: () => "2026-11-19T00:00:00.000Z",
        sendMessage: async (message) => {
          sent.push(message);
          return { ok: true };
        },
      },
    ),
  ).resolves.toBe(true);
  expect(sent[0]).toMatchObject({
    url: "https://example.test/hook",
    body: { embeds: [{ timestamp: "2026-11-19T00:00:00.000Z" }] },
  });
});

test("logs webhook delivery failures and returns false", async () => {
  const warnings = [];
  const log = { warn: (message) => warnings.push(message) };
  await expect(
    notifyConductor(
      { title: "Release", description: "Complete" },
      {
        env: { DISCORD_WEBHOOK: "https://example.test/hook" },
        sendMessage: async () => ({ ok: false, status: 503 }),
        log,
      },
    ),
  ).resolves.toBe(false);
  await notifyConductor(
    { title: "Release", description: "Complete" },
    {
      env: { DISCORD_WEBHOOK: "https://example.test/hook" },
      sendMessage: async () => {
        throw new Error("offline");
      },
      log,
    },
  );
  expect(warnings).toEqual([
    "[conductor] Discord notification failed: Discord returned HTTP 503",
    "[conductor] Discord notification failed: offline",
  ]);
});

test("uses the default webhook sender and logger dependencies", async () => {
  const previous = process.env.CONDUCTOR_DISCORD_WEBHOOK;
  process.env.CONDUCTOR_DISCORD_WEBHOOK = "https://example.test/default";
  sendMessage
    .mockResolvedValueOnce({ ok: true })
    .mockRejectedValueOnce(new Error("default offline"));
  try {
    await expect(notifyConductor({ title: "Release", description: "Complete" })).resolves.toBe(
      true,
    );
    await expect(notifyConductor({ title: "Release", description: "Complete" })).resolves.toBe(
      false,
    );
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalledWith(
      "[conductor] Discord notification failed: default offline",
    );
  } finally {
    if (previous === undefined) delete process.env.CONDUCTOR_DISCORD_WEBHOOK;
    else process.env.CONDUCTOR_DISCORD_WEBHOOK = previous;
  }
});
