import { json } from "@remix-run/node";
import prisma from "../db.server";

const STALE_THRESHOLD_MS = 60_000;

/* ---------- CORS HEADERS ---------- */
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/* ---------- OPTIONS (PREFLIGHT) ---------- */
export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("Origin");
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
};

/* ---------- LOADER ---------- */
export const loader = async ({ request }) => {
  const origin = request.headers.get("Origin");
  const headers = corsHeaders(origin);
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    console.log("❌ No shop param found");
    return json({ online: false }, { headers });
  }

  const record = await prisma.adminStatus.findUnique({
    where: { shop },
  });

  if (!record || !record.isOnline) {
    return json({ online: false }, { headers });
  }

  const lastHeartbeatTime = new Date(record.lastHeartbeat).getTime();
  const now = Date.now();
  const elapsed = now - lastHeartbeatTime;

  // Debugging ke liye console log
  console.log(`Checking status for ${shop}: Elapsed ${elapsed}ms`);

  if (elapsed >= STALE_THRESHOLD_MS) {
    return json({ online: false, reason: "stale" }, { headers });
  }

  return json({ online: true }, { headers });
};
