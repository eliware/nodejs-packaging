import { redactText } from "@eliware/common";

export default function redactCommandOutput(text, env = process.env) {
  const secrets = Object.entries(env)
    .filter(
      ([name, value]) =>
        /(SECRET|TOKEN|PASSWORD|PASSWD|WEBHOOK|CREDENTIAL|KEY)/i.test(name) &&
        typeof value === "string" &&
        value.length >= 6,
    )
    .map(([, value]) => value);
  return redactText(text, { secrets, maxOutputLength: Number.MAX_SAFE_INTEGER });
}
