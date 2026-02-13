// app/routes/app.chat.admin.data.jsx
// ─────────────────────────────────────────────────────────────────────────────
// This is the polling endpoint called every 500 ms by the admin UI.
// It mirrors the loader logic from app.chat.admin.jsx but:
//   • skips Shopify OAuth (uses the same session/shop from the request)
//   • returns pure JSON with CORS headers so the client fetch() works
// ─────────────────────────────────────────────────────────────────────────────

import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { canCreateChat, shouldBlurChat } from "../planLimits.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
};

export const loader = async ({ request }) => {
  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { session } = await authenticate.admin(request);
  const shop = session?.shop;

  if (!shop) {
    return json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  // ── Fetch sessions ordered by most-recent activity ────────────────────────
  const sessions = await prisma.chatSession.findMany({
    where: { shop },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // ── Plan limits ───────────────────────────────────────────────────────────
  const chatLimit = await canCreateChat(shop);

  // Creation order is needed to calculate isOverLimit correctly
  const sessionsByCreation = [...sessions].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );

  const sessionsWithLimitInfo = await Promise.all(
    sessions.map(async (s) => {
      const creationIndex = sessionsByCreation.findIndex(
        (x) => x.sessionId === s.sessionId
      );
      const isOverLimit =
        chatLimit.max > 0 && creationIndex >= chatLimit.max;

      const blurInfo = await shouldBlurChat(shop, s.createdAt);

      return {
        ...s,
        chatIndex: creationIndex + 1,
        isOverLimit,
        shouldBlur: blurInfo.shouldBlur,
        blurReason: blurInfo.reason,
        retentionDays: blurInfo.retentionDays,
        currentPlan: blurInfo.plan,
      };
    })
  );

  // ── Plan usage summary ────────────────────────────────────────────────────
  const withinLimit = sessions.length; // total for "current"
  const planLimit = {
    current: sessions.length,
    max: chatLimit.max,
    remaining: chatLimit.remaining,
    isNearLimit: chatLimit.remaining <= 5 && chatLimit.remaining > 0,
    isAtLimit: !chatLimit.allowed,
    isOverLimit: chatLimit.max > 0 && sessions.length > chatLimit.max,
    overLimitBy:
      chatLimit.max > 0 ? Math.max(0, sessions.length - chatLimit.max) : 0,
  };

  return json(
    { sessions: sessionsWithLimitInfo, planLimit },
    { headers: corsHeaders }
  );
};