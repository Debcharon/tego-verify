import { readSigningKey } from "./protocol.js";

const providers = {
  turnstile: ["TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"],
  hcaptcha: ["HCAPTCHA_SITE_KEY", "HCAPTCHA_SECRET_KEY"],
};

export function readConfiguration(env = process.env) {
  const provider = env.CAPTCHA_PROVIDER || "turnstile";
  const names = providers[provider];
  if (!names) return null;

  const [siteKeyName, secretName] = names;
  const siteKey = env[siteKeyName];
  const secret = env[secretName];
  const hostname = env.VERIFY_HOSTNAME;
  if (!siteKey || !secret || !hostname || hostname.includes("/") || hostname.includes(":")) {
    return null;
  }

  try {
    return {
      provider,
      siteKey,
      secret,
      hostname,
      key: readSigningKey(env.VERIFY_SIGNING_KEY),
    };
  } catch {
    return null;
  }
}
