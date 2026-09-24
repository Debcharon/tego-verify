import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { parseTicket, readSigningKey, signTicket, verifyTelegramInitData } from "../lib/protocol.js";
import { verifySubmission } from "../api/verify.js";

const key = readSigningKey("00".repeat(32));
const nonce = Buffer.alloc(16, 1).toString("base64url");
const now = 2000000000;
const challenge = signTicket("c", "12345", now + 600, nonce, key);
const config = { botID: "777", hostname: "verify.example.com", turnstileSecret: "secret", key };

test("tickets enforce type, expiry, MAC, and canonical fields", () => {
  assert.deepEqual(parseTicket(challenge, "c", key, now), { userID: "12345", expiresAt: now + 600, nonce });
  assert.equal(parseTicket(challenge, "p", key, now), null);
  assert.equal(parseTicket(challenge, "c", key, now + 601), null);
  assert.equal(parseTicket(challenge.replace("12345", "12346"), "c", key, now), null);
  assert.equal(parseTicket(challenge + "x", "c", key, now), null);
});

test("Telegram third-party initData binds bot and user", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicHex = publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("hex");
  const entries = [
    ["auth_date", String(now)],
    ["query_id", "sample"],
    ["user", JSON.stringify({ id: 12345, first_name: "Test" })],
  ];
  const check = "777:WebAppData\n" + entries.map(([k, v]) => k + "=" + v).join("\n");
  const signature = sign(null, Buffer.from(check), privateKey).toString("base64url");
  const raw = new URLSearchParams([...entries, ["signature", signature]]).toString();
  assert.deepEqual(verifyTelegramInitData(raw, "777", now, publicHex), { userID: "12345" });
  assert.equal(verifyTelegramInitData(raw, "778", now, publicHex), null);
  assert.equal(verifyTelegramInitData(raw, "777", now + 901, publicHex), null);
  assert.equal(verifyTelegramInitData(raw + "&user=%7B%7D", "777", now, publicHex), null);
});

test("server issues proof only for matched Telegram user and valid Turnstile response", async () => {
  const input = { challenge, initData: "signed", token: "turnstile-token" };
  let calls = 0;
  const siteverify = async () => {
    calls++;
    return { ok: true, json: async () => ({ success: true, hostname: "verify.example.com", action: "tego_verify" }) };
  };
  const accepted = await verifySubmission(input, config, now, siteverify, () => ({ userID: "12345" }));
  assert.equal(accepted.status, 200);
  assert.deepEqual(parseTicket(accepted.proof, "p", key, now), { userID: "12345", expiresAt: now + 300, nonce });
  assert.equal(calls, 1);
  const mismatch = await verifySubmission(input, config, now, siteverify, () => ({ userID: "12346" }));
  assert.equal(mismatch.status, 403);
  assert.equal(calls, 1);
  const badSite = await verifySubmission(input, config, now, async () =>
    ({ ok: true, json: async () => ({ success: true, hostname: "other.example.com", action: "tego_verify" }) }),
    () => ({ userID: "12345" }));
  assert.equal(badSite.status, 403);
});
