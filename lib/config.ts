import { readSigningKey } from "./protocol";

export type CaptchaProvider = "turnstile" | "hcaptcha";
export type Configuration = {
  provider: CaptchaProvider;
  siteKey: string;
  secret: string;
  hostname: string;
  key: Buffer;
};

const providers: Record<CaptchaProvider, readonly [string, string]> = {
  turnstile: ["TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"],
  hcaptcha: ["HCAPTCHA_SITE_KEY", "HCAPTCHA_SECRET_KEY"],
};

export function readConfiguration(env: Record<string, string | undefined> = process.env): Configuration | null {
  const provider = env.CAPTCHA_PROVIDER || "turnstile";
  const names = providers[provider as CaptchaProvider];
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
      provider: provider as CaptchaProvider,
      siteKey,
      secret,
      hostname,
      key: readSigningKey(env.VERIFY_SIGNING_KEY),
    };
  } catch {
    return null;
  }
}
