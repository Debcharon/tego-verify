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
    return { status: 400, error: "Invalid request", code: "invalid_request" };
  }
  const challenge = parseTicket(input.challenge, "c", config.key, now);
  if (!challenge) {
    return { status: 403, error: "Verification link is invalid or expired", code: "invalid_ticket" };
  }
  const siteverifyURL = siteverifyURLs[config.provider];
  if (!siteverifyURL) return { status: 503, error: "Verification is not configured", code: "invalid_provider" };
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
    if (!response.ok) return { status: 503, error: "Verification service unavailable", code: "provider_unavailable" };
    result = await response.json();
  } catch {
    return { status: 503, error: "Verification service unavailable", code: "provider_unavailable" };
  }
  if (result?.success !== true) {
    const providerCodes = Array.isArray(result?.["error-codes"])
      ? result["error-codes"].filter(code => typeof code === "string").slice(0, 5).map(code => code.slice(0, 64))
      : [];
    return { status: 403, error: "Challenge failed", code: "captcha_rejected", providerCodes };
  }
  // hCaptcha validates the expected sitekey at siteverify. Its hostname is diagnostic,
  // not an authentication field, and can differ for aliases or be "not-provided".
  if (config.provider === "turnstile" && result.hostname !== config.hostname) {
    return { status: 403, error: "Challenge failed", code: "hostname_mismatch" };
  }
  if (config.provider === "turnstile" && result.action !== "tego_verify") {
    return { status: 403, error: "Challenge failed", code: "action_mismatch" };
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
    console.warn("verification rejected", {
      provider: config.provider,
      code: result.code,
      providerCodes: result.providerCodes,
    });
    return Response.json({ error: result.error, code: result.code }, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return Response.json({ proof: result.proof }, {
    headers: { "Cache-Control": "no-store" },
  });
}