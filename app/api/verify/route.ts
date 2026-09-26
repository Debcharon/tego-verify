import { readConfiguration } from "../../../lib/config";
import { verifySubmission } from "../../../lib/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
