import test from "node:test";
import assert from "node:assert/strict";
import { parseTicket, readSigningKey, signTicket } from "../lib/protocol.js";
import { verifySubmission } from "../api/verify.js";

const key = readSigningKey("00".repeat(32));
const nonce = Buffer.alloc(16, 1).toString("base64url");
const now = 2000000000;
const challenge = signTicket("c", "12345", now + 600, nonce, key);
const config = { provider: "turnstile", siteKey: "turnstile-site", hostname: "verify.example.com", secret: "secret", key };

test("tickets enforce type, expiry, MAC, and canonical fields", () => {
  assert.deepEqual(parseTicket(challenge, "c", key, now), { userID: "12345", expiresAt: now + 600, nonce });
  assert.equal(parseTicket(challenge, "p", key, now), null);
  assert.equal(parseTicket(challenge, "c", key, now + 601), null);
  assert.equal(parseTicket(challenge.replace("12345", "12346"), "c", key, now), null);
  assert.equal(parseTicket(challenge + "x", "c", key, now), null);
});

test("server issues proof only for valid challenge and Turnstile response", async () => {
  const input = { challenge, token: "turnstile-token" };
  let calls = 0;
  const siteverify = async (url, options) => {
    assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    assert.equal(options.body.get("secret"), "secret");
    assert.equal(options.body.get("response"), input.token);
    assert.equal(options.body.has("sitekey"), false);
    calls++;
    return { ok: true, json: async () => ({ success: true, hostname: "verify.example.com", action: "tego_verify" }) };
  };
  const accepted = await verifySubmission(input, config, now, siteverify);
  assert.equal(accepted.status, 200);
  assert.deepEqual(parseTicket(accepted.proof, "p", key, now), { userID: "12345", expiresAt: now + 300, nonce });
  assert.equal(calls, 1);
  const invalid = await verifySubmission({ ...input, challenge: challenge.replace("12345", "12346") }, config, now, siteverify);
  assert.equal(invalid.status, 403);
  assert.equal(calls, 1);
  const badSite = await verifySubmission(input, config, now, async () =>
    ({ ok: true, json: async () => ({ success: true, hostname: "other.example.com", action: "tego_verify" }) }));
  assert.equal(badSite.status, 403);
});

test("hCaptcha checks the configured sitekey and issues the same bot proof", async () => {
  const input = { challenge, token: "hcaptcha-token" };
  const hcaptcha = { ...config, provider: "hcaptcha", siteKey: "hcaptcha-site" };
  let calls = 0;
  const siteverify = async (url, options) => {
    calls++;
    assert.equal(url, "https://api.hcaptcha.com/siteverify");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["Content-Type"], "application/x-www-form-urlencoded");
    assert.equal(options.body.get("secret"), "secret");
    assert.equal(options.body.get("response"), input.token);
    assert.equal(options.body.get("sitekey"), hcaptcha.siteKey);
    return { ok: true, json: async () => ({ success: true, hostname: hcaptcha.hostname }) };
  };
  const accepted = await verifySubmission(input, hcaptcha, now, siteverify);
  assert.equal(accepted.status, 200);
  assert.deepEqual(parseTicket(accepted.proof, "p", key, now), { userID: "12345", expiresAt: now + 300, nonce });
  assert.equal(calls, 1);

  const wrongHost = await verifySubmission(input, hcaptcha, now, async () =>
    ({ ok: true, json: async () => ({ success: true, hostname: "other.example.com" }) }));
  assert.equal(wrongHost.status, 403);
  const rejected = await verifySubmission(input, hcaptcha, now, async () =>
    ({ ok: true, json: async () => ({ success: false, hostname: hcaptcha.hostname }) }));
  assert.equal(rejected.status, 403);
  const unavailable = await verifySubmission(input, hcaptcha, now, async () =>
    ({ ok: false }));
  assert.equal(unavailable.status, 503);
  const malformed = await verifySubmission(input, hcaptcha, now, async () =>
    ({ ok: true, json: async () => null }));
  assert.equal(malformed.status, 403);
});

test("unknown provider fails closed", async () => {
  const result = await verifySubmission({ challenge, token: "token" }, { ...config, provider: "other" }, now,
    async () => { throw new Error("should not call provider"); });
  assert.equal(result.status, 503);
});
