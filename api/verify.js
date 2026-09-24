import { readConfiguration } from "../lib/config.js";
import { parseTicket, signTicket } from "../lib/protocol.js";

const siteverifyURLs = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  hcaptcha: "https://api.hcaptcha.com/siteverify",
};

export async function verifySubmission(input, config, now, fetchSiteverify = fetch) {
  if (!input || typeof input.challenge !== "string" ||
      typeof input.token !== "string" || input.challenge.length > 256 ||
      input.token.length < 1 || input.token.length > 4096) {
    return { status: 400, error: "Invalid request" };
  }
  const challenge = parseTicket(input.challenge, "c", config.key, now);
  if (!challenge) {
    return { status: 403, error: "Verification link is invalid or expired" };
  }
  const siteverifyURL = siteverifyURLs[config.provider];
  if (!siteverifyURL) return { status: 503, error: "Verification is not configured" };
  let result;
  try {
    const fields = { secret: config.secret, response: input.token };
    if (config.provider === "hcaptcha") fields.sitekey = config.siteKey;
    const response = await fetchSiteverify(siteverifyURL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return { status: 503, error: "Verification service unavailable" };
    result = await response.json();
  } catch {
    return { status: 503, error: "Verification service unavailable" };
  }
  if (result?.success !== true || result.hostname !== config.hostname ||
      (config.provider === "turnstile" && result.action !== "tego_verify")) {
    return { status: 403, error: "Challenge failed" };
  }
  return {
    status: 200,
    proof: signTicket("p", challenge.userID, now + 300, challenge.nonce, config.key),
  };
}

export async function POST(request) {
  const config = readConfiguration();
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