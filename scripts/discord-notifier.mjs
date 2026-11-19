const colors = { success: 0x2ecc71, failure: 0xe74c3c, warning: 0xf5c451, info: 0x3498db };
const webhookUrl = process.env.CONDUCTOR_DISCORD_WEBHOOK || process.env.DISCORD_WEBHOOK || "";

export function hasDiscordWebhook() {
  return Boolean(webhookUrl);
}

export async function notifyConductor({ title, description, status = "info", fields = [], cardUrl = "" }) {
  if (!webhookUrl) return false;
  const embed = {
    title: String(title).slice(0, 256),
    description: String(description).slice(0, 4096),
    color: colors[status] || colors.info,
    fields: fields.slice(0, 25).map((field) => ({
      name: String(field.name).slice(0, 256),
      value: String(field.value || "—").slice(0, 1024),
      inline: field.inline !== false,
    })),
    author: { name: "Eliware Node.js Release Conductor" },
    footer: { text: "Certified Node.js 26 release · nodejs.eliware.org" },
    timestamp: new Date().toISOString(),
  };
  if (cardUrl) embed.image = { url: cardUrl };
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "Node.js Conductor", embeds: [embed] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Discord returned HTTP ${response.status}`);
    return true;
  } catch (error) {
    console.warn(`[conductor] Discord notification failed: ${error.message}`);
    return false;
  }
}
