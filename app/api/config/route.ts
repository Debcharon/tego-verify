import { readConfiguration } from "../../../lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const config = readConfiguration();
  if (!config) {
    return Response.json({ error: "Verification is not configured" }, { status: 503 });
  }
  return Response.json({ provider: config.provider, siteKey: config.siteKey }, {
    headers: { "Cache-Control": "no-store" },
  });
}
