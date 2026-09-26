import test from "node:test";
import assert from "node:assert/strict";
import { readConfiguration } from "../lib/config.ts";

const base = {
  TURNSTILE_SITE_KEY: "turnstile-site",
  TURNSTILE_SECRET_KEY: "turnstile-secret",
  VERIFY_HOSTNAME: "verify.example.com",
  VERIFY_SIGNING_KEY: "00".repeat(32),
};

test("Turnstile remains the default provider", () => {
  const config = readConfiguration(base);
  assert.ok(config);
  assert.equal(config.provider, "turnstile");
  assert.equal(config.siteKey, "turnstile-site");
  assert.equal(config.secret, "turnstile-secret");
});

test("hCaptcha selects only its own credentials", () => {
  const config = readConfiguration({
    ...base,
    CAPTCHA_PROVIDER: "hcaptcha",
    HCAPTCHA_SITE_KEY: "hcaptcha-site",
    HCAPTCHA_SECRET_KEY: "hcaptcha-secret",
  });
  assert.ok(config);
  assert.equal(config.provider, "hcaptcha");
  assert.equal(config.siteKey, "hcaptcha-site");
  assert.equal(config.secret, "hcaptcha-secret");
});

test("incomplete or unknown provider configuration is rejected", () => {
  assert.equal(readConfiguration({ ...base, CAPTCHA_PROVIDER: "hcaptcha" }), null);
  assert.equal(readConfiguration({ ...base, CAPTCHA_PROVIDER: "invalid" }), null);
  assert.equal(readConfiguration({ ...base, VERIFY_HOSTNAME: "https://verify.example.com" }), null);
  assert.equal(readConfiguration({ ...base, VERIFY_SIGNING_KEY: "bad" }), null);
});
