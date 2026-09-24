import { createHmac, timingSafeEqual } from "node:crypto";

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
