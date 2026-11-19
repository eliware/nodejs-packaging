import { log } from "@eliware/common";
import { sendMessage } from "@eliware/discord-webhook";

const colors = { success: 0x2ecc71, failure: 0xe74c3c, warning: 0xf5c451, info: 0x3498db };

function getWebhookUrl(env = process.env) {
  return env.CONDUCTOR_DISCORD_WEBHOOK || env.DISCORD_WEBHOOK || "";
}

function hasDiscordWebhook(env = process.env) {
  return Boolean(getWebhookUrl(env));
}

function createConductorEmbed(
  { title, description, status = "info", fields = [], cardUrl = "" },
  timestamp = new Date().toISOString(),
) {
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
    timestamp,
  };
  if (cardUrl) embed.image = { url: cardUrl };
  return embed;
}

async function notifyConductor(options, dependencies = {}) {
  const webhookUrl = getWebhookUrl(dependencies.env);
  if (!webhookUrl) return false;
  const embed = createConductorEmbed(options, dependencies.now?.() || new Date().toISOString());
  try {
    const response = await (dependencies.sendMessage || sendMessage)({
      url: webhookUrl,
      timeoutMs: 10_000,
      body: { username: "Node.js Conductor", embeds: [embed] },
    });
    if (!response.ok) throw new Error(`Discord returned HTTP ${response.status}`);
    return true;
  } catch (error) {
    (dependencies.log || log).warn(`[conductor] Discord notification failed: ${error.message}`);
    return false;
  }
}

export default function moduleApi() {
  return { getWebhookUrl, hasDiscordWebhook, createConductorEmbed, notifyConductor };
}
