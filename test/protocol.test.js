import test from "node:test";
import assert from "node:assert/strict";
import { parseTicket, readSigningKey, signTicket } from "../lib/protocol.js";
import { verifySubmission } from "../api/verify.js";

const key = readSigningKey("00".repeat(32));
const nonce = Buffer.alloc(16, 1).toString("base64url");
const now = 2000000000;
const challenge = signTicket("c", "12345", now + 600, nonce, key);
const config = { hostname: "verify.example.com", turnstileSecret: "secret", key };

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
  const siteverify = async () => {
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
