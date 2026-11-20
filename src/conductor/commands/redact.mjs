import { defaultPolicy, redactText, redactValue } from "@eliware/common";

export default function redactCommandOutput(text, env = process.env) {
  const secrets = Object.entries(env).flatMap(([name, value]) => {
    if (typeof value !== "string" || value.length < 6) return [];
    const aliases = new Set([name, name.replace(/[^a-z0-9]/gi, ""), name.split(/[_-]/).at(-1)]);
    const values = Object.fromEntries([...aliases].map((alias) => [alias, value]));
    return Object.values(redactValue(values)).includes(defaultPolicy.marker) ? [value] : [];
  });
  return redactText(text, { secrets, maxOutputLength: Number.MAX_SAFE_INTEGER });
}
