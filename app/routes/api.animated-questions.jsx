// ═══════════════════════════════════════════════════════════════
//  File: app/routes/api.animated-questions.jsx
//
//  Handles:
//    GET  /api/animated-questions?shop=xxx           → list questions
//    GET  /api/animated-questions?shop=xxx&admin=true → all (admin)
//    POST /api/animated-questions                    → create question
//    POST /api/animated-questions (action=settings)  → save settings
// ═══════════════════════════════════════════════════════════════

import { json } from "@remix-run/node";
import {
  getAnimatedQuestions,
  createAnimatedQuestion,
  saveAnimatedQuestionSettings,
} from "./app.services.animatedQuestions";

// ── CORS headers — Shopify widget ke liye zaroori ───────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ── OPTIONS preflight ────────────────────────────────────────
export async function action({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const body = await request.json().catch(() => ({}));
  const { shop, action: actionType } = body;

  if (!shop) {
    return json({ error: "shop is required" }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    // ── Save settings ──
    if (actionType === "settings") {
      const result = await saveAnimatedQuestionSettings(shop, body.settings);
      return json(result, { headers: CORS_HEADERS });
    }

    // ── Create question ──
    const result = await createAnimatedQuestion(body);
    return json(result, { status: 201, headers: CORS_HEADERS });

  } catch (err) {
    console.error("[AQ] action error:", err.message);
    return json(
      { error: err.message || "Internal server error" },
      { status: err.message === "Forbidden" ? 403 : 500, headers: CORS_HEADERS }
    );
  }
}

// ── GET — fetch questions ────────────────────────────────────
export async function loader({ request }) {
  const url    = new URL(request.url);
  const shop   = url.searchParams.get("shop");
  const isAdmin = url.searchParams.get("admin") === "true";

  if (!shop) {
    return json({ error: "shop is required" }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const result = await getAnimatedQuestions(shop, isAdmin);
    return json(result, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[AQ] loader error:", err.message);
    return json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}