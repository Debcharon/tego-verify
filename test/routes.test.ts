import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/config/route.ts";
import { POST } from "../app/api/verify/route.ts";

const names = [
  "CAPTCHA_PROVIDER", "TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY",
  "HCAPTCHA_SITE_KEY", "HCAPTCHA_SECRET_KEY", "VERIFY_HOSTNAME", "VERIFY_SIGNING_KEY",
];

test("Next.js route handlers preserve public config and reject invalid proof requests", async () => {
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    process.env.CAPTCHA_PROVIDER = "hcaptcha";
    process.env.HCAPTCHA_SITE_KEY = "public-site-key";
    process.env.HCAPTCHA_SECRET_KEY = "private-secret";
    process.env.VERIFY_HOSTNAME = "verify.example.com";
    process.env.VERIFY_SIGNING_KEY = "00".repeat(32);
    const config = await GET();
    assert.equal(config.status, 200);
    assert.equal(config.headers.get("cache-control"), "no-store");
    assert.deepEqual(await config.json(), { provider: "hcaptcha", siteKey: "public-site-key" });

    const invalid = await POST(new Request("https://verify.example.com/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge: "invalid", token: "captcha-token" }),
    }));
    assert.equal(invalid.status, 403);
    assert.equal((await invalid.json()).code, "invalid_ticket");
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
