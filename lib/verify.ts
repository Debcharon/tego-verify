import type { Configuration } from "./config";
import { parseTicket, signTicket } from "./protocol";

const siteverifyURLs: Record<string, string> = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  hcaptcha: "https://api.hcaptcha.com/siteverify",
};

type Submission = { challenge: string; token: string };
type SiteverifyResult = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: unknown;
};
type VerificationResult = {
  status: number;
  error?: string;
  code?: string;
  providerCodes?: string[];
  proof?: string;
};
type SiteverifyFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: URLSearchParams; signal: AbortSignal },
) => Promise<{ ok: boolean; json?: () => Promise<unknown> }>;

export async function verifySubmission(
  input: unknown,
  config: Configuration,
  now: number,
  fetchSiteverify: SiteverifyFetch = fetch,
): Promise<VerificationResult> {
  if (!input || typeof input !== "object" || !("challenge" in input) || !("token" in input) ||
      typeof input.challenge !== "string" ||
      typeof input.token !== "string" || input.challenge.length > 256 ||
      input.token.length < 1 || input.token.length > 4096) {
    return { status: 400, error: "Invalid request", code: "invalid_request" };
  }
  const submission = input as Submission;
  const challenge = parseTicket(submission.challenge, "c", config.key, now);
  if (!challenge) {
    return { status: 403, error: "Verification link is invalid or expired", code: "invalid_ticket" };
  }
  const siteverifyURL = siteverifyURLs[config.provider];
  if (!siteverifyURL) return { status: 503, error: "Verification is not configured", code: "invalid_provider" };
  let result;
  try {
    const fields: Record<string, string> = { secret: config.secret, response: submission.token };
    if (config.provider === "hcaptcha") fields.sitekey = config.siteKey;
    const response = await fetchSiteverify(siteverifyURL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return { status: 503, error: "Verification service unavailable", code: "provider_unavailable" };
    if (!response.json) throw new Error("invalid provider response");
    result = await response.json() as SiteverifyResult | null;
  } catch {
    return { status: 503, error: "Verification service unavailable", code: "provider_unavailable" };
  }
  if (result?.success !== true) {
    const providerCodes = Array.isArray(result?.["error-codes"])
      ? result["error-codes"].filter((code): code is string => typeof code === "string").slice(0, 5).map(code => code.slice(0, 64))
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
