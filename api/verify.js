import { parseTicket, readSigningKey, signTicket, verifyTelegramInitData } from "../lib/protocol.js";

const siteverifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function configuration() {
  const botID = process.env.TELEGRAM_BOT_ID;
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  const hostname = process.env.VERIFY_HOSTNAME;
  if (!/^[1-9][0-9]*$/.test(botID || "") || !siteKey || !turnstileSecret ||
      !hostname || hostname.includes("/") || hostname.includes(":")) {
    return null;
  }
  try {
    return { botID, siteKey, turnstileSecret, hostname, key: readSigningKey(process.env.VERIFY_SIGNING_KEY) };
  } catch {
    return null;
  }
}

export async function verifySubmission(input, config, now, fetchSiteverify = fetch,
                                       checkTelegram = verifyTelegramInitData) {
  if (!input || typeof input.challenge !== "string" || typeof input.initData !== "string" ||
      typeof input.token !== "string" || input.challenge.length > 256 ||
      input.initData.length > 4096 || input.token.length < 1 || input.token.length > 2048) {
    return { status: 400, error: "Invalid request" };
  }
  const challenge = parseTicket(input.challenge, "c", config.key, now);
  const telegram = checkTelegram(input.initData, config.botID, now);
  if (!challenge || !telegram || telegram.userID !== challenge.userID) {
    return { status: 403, error: "Verification link is invalid or expired" };
  }
  let result;
  try {
    const response = await fetchSiteverify(siteverifyURL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: config.turnstileSecret,
        response: input.token,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return { status: 503, error: "Verification service unavailable" };
    result = await response.json();
  } catch {
    return { status: 503, error: "Verification service unavailable" };
  }
  if (result.success !== true || result.hostname !== config.hostname ||
      result.action !== "tego_verify") {
    return { status: 403, error: "Challenge failed" };
  }
  return {
    status: 200,
    proof: signTicket("p", challenge.userID, now + 300, challenge.nonce, config.key),
  };
}

export async function POST(request) {
  const config = configuration();
  if (!config) {
    return Response.json({ error: "Verification is not configured" }, { status: 503 });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "JSON required" }, { status: 415 });
  }
  let input;
  try {
    const body = await request.text();
    if (body.length > 8192) throw new Error("too large");
    input = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const result = await verifySubmission(input, config, Math.floor(Date.now() / 1000));
  if (result.status !== 200) {
    return Response.json({ error: result.error }, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return Response.json({ proof: result.proof }, {
    headers: { "Cache-Control": "no-store" },
  });
}