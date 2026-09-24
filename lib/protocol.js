import { createHmac, createPublicKey, timingSafeEqual, verify as verifySignature } from "node:crypto";

const telegramProductionKey = "e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d";
const ed25519SPKI = Buffer.from("302a300506032b6570032100", "hex");
const userIDPattern = /^[1-9][0-9]{0,15}$/;
const noncePattern = /^[A-Za-z0-9_-]{22}$/;

export function readSigningKey(value) {
  if (typeof value !== "string" || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("VERIFY_SIGNING_KEY must be 64 hexadecimal characters");
  }
  return Buffer.from(value, "hex");
}

function validUserID(value) {
  return typeof value === "string" && userIDPattern.test(value) &&
    Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function validNonce(value) {
  if (typeof value !== "string" || !noncePattern.test(value)) return false;
  const decoded = Buffer.from(value, "base64url");
  return decoded.length === 16 && decoded.toString("base64url") === value;
}

export function signTicket(kind, userID, expiresAt, nonce, key) {
  if (!["c", "p"].includes(kind) || !validUserID(userID) ||
      !Number.isSafeInteger(expiresAt) || !validNonce(nonce) ||
      !Buffer.isBuffer(key) || key.length !== 32) {
    throw new Error("invalid ticket fields");
  }
  const payload = ["v1", kind, userID, String(expiresAt), nonce].join(".");
  const mac = createHmac("sha256", key).update(payload).digest("base64url");
  return payload + "." + mac;
}

export function parseTicket(ticket, kind, key, now = Math.floor(Date.now() / 1000)) {
  if (typeof ticket !== "string" || ticket.length > 256 ||
      !Buffer.isBuffer(key) || key.length !== 32) return null;
  const parts = ticket.split(".");
  if (parts.length !== 6 || parts[0] !== "v1" || parts[1] !== kind ||
      !validUserID(parts[2]) || !/^[1-9][0-9]*$/.test(parts[3]) ||
      !validNonce(parts[4])) return null;
  const expiresAt = Number(parts[3]);
  const maxLifetime = kind === "c" ? 900 : 360;
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now ||
      expiresAt > now + maxLifetime) return null;
  if (!/^[A-Za-z0-9_-]{43}$/.test(parts[5])) return null;
  const received = Buffer.from(parts[5], "base64url");
  if (received.length !== 32 || received.toString("base64url") !== parts[5]) return null;
  const expected = createHmac("sha256", key).update(parts.slice(0, 5).join(".")).digest();
  if (!timingSafeEqual(received, expected)) return null;
  return { userID: parts[2], expiresAt, nonce: parts[4] };
}

export function verifyTelegramInitData(raw, botID, now = Math.floor(Date.now() / 1000),
                                       publicKeyHex = telegramProductionKey) {
  if (typeof raw !== "string" || raw.length > 4096 || !validUserID(String(botID))) return null;
  const params = new URLSearchParams(raw);
  const values = new Map();
  for (const [key, value] of params) {
    if (values.has(key)) return null;
    values.set(key, value);
  }
  const signature = values.get("signature");
  const authDate = Number(values.get("auth_date"));
  if (typeof signature !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(signature) ||
      !Number.isSafeInteger(authDate) || authDate > now + 60 || authDate < now - 900) {
    return null;
  }
  const signatureBytes = Buffer.from(signature, "base64url");
  if (signatureBytes.length !== 64 || signatureBytes.toString("base64url") !== signature) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(publicKeyHex)) return null;
  const entries = [...values.entries()].filter(([key]) => key !== "hash" && key !== "signature");
  entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const check = String(botID) + ":WebAppData\n" +
    entries.map(([key, value]) => key + "=" + value).join("\n");
  const publicKey = createPublicKey({
    key: Buffer.concat([ed25519SPKI, Buffer.from(publicKeyHex, "hex")]),
    format: "der",
    type: "spki",
  });
  if (!verifySignature(null, Buffer.from(check), publicKey, signatureBytes)) return null;
  let user;
  try {
    user = JSON.parse(values.get("user") || "");
  } catch {
    return null;
  }
  if (!user || !validUserID(String(user.id))) return null;
  return { userID: String(user.id) };
}
