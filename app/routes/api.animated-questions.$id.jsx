// ═══════════════════════════════════════════════════════════════
//  File: app/routes/api.animated-questions.$id.jsx
//
//  Handles:
//    PUT    /api/animated-questions/:id   → update question
//    DELETE /api/animated-questions/:id   → delete question
// ═══════════════════════════════════════════════════════════════

import { json } from "@remix-run/node";
import {
  updateAnimatedQuestion,
  deleteAnimatedQuestion,
} from "./services/animatedQuestions.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function action({ request, params }) {
  const { id } = params;
  const method  = request.method.toUpperCase();

  // OPTIONS preflight
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const body = await request.json().catch(() => ({}));
  const { shop } = body;

  if (!shop) {
    return json({ error: "shop is required" }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    // ── DELETE ──
    if (method === "DELETE") {
      const result = await deleteAnimatedQuestion(id, shop);
      return json(result, { headers: CORS_HEADERS });
    }

    // ── PUT (update) ──
    if (method === "PUT") {
      const result = await updateAnimatedQuestion(id, shop, body);
      return json(result, { headers: CORS_HEADERS });
    }

    return json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS });

  } catch (err) {
    console.error("[AQ] $id action error:", err.message);
    const status =
      err.message === "Forbidden"       ? 403 :
      err.message === "Question not found" ? 404 : 500;
    return json({ error: err.message }, { status, headers: CORS_HEADERS });
  }
}