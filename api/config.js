export function GET() {
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  if (!siteKey) {
    return Response.json({ error: "Verification is not configured" }, { status: 503 });
  }
  return Response.json({ siteKey }, {
    headers: { "Cache-Control": "no-store" },
  });
}