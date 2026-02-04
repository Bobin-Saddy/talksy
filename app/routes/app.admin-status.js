import { json } from "@remix-run/node";
import prisma from "../db.server";

const STALE_THRESHOLD_MS = 60_000;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export const loader = async ({ request }) => {
  const origin = request.headers.get("Origin");
  const headers = corsHeaders(origin);

  // URL se shop nikalne ke liye ye line zaroori hai
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return json({ online: false, error: "Missing shop" }, { headers });
  }

  try {
    const record = await prisma.adminStatus.findUnique({ where: { shop } });

    if (!record || !record.isOnline) {
      return json({ online: false }, { headers });
    }

    const lastHeartbeat = new Date(record.lastHeartbeat).getTime();
    const now = Date.now();
    const diff = now - lastHeartbeat;

    // console.log(`DEBUG: Shop: ${shop}, Diff: ${diff}ms`);

    // Agar 60 seconds se zyada ho gaye toh offline dikhao
    if (diff >= STALE_THRESHOLD_MS) {
      return json({ online: false, reason: "stale" }, { headers });
    }

    return json({ online: true }, { headers });
  } catch (error) {
    return json({ online: false }, { headers });
  }
};