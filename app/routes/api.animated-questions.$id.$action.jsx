// ═══════════════════════════════════════════════════════════════
//  File: app/routes/api.animated-questions.$id.$action.jsx
//
//  Handles:
//    POST /api/animated-questions/:id/click   → track click
//    POST /api/animated-questions/:id/dismiss → track dismiss
// ═══════════════════════════════════════════════════════════════

import { json } from "@remix-run/node";
import {
  trackQuestionClick,
  trackQuestionDismiss,
} from "./services/animatedQuestions.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function action({ request, params }) {
  const { id, action: actionType } = params;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    if (actionType === "click") {
      const result = await trackQuestionClick(id);
      return json(result, { headers: CORS_HEADERS });
    }

    if (actionType === "dismiss") {
      const result = await trackQuestionDismiss(id);
      return json(result, { headers: CORS_HEADERS });
    }

    return json({ error: "Unknown action" }, { status: 400, headers: CORS_HEADERS });

  } catch (err) {
    // Analytics fail hona non-critical hai
    console.error("[AQ] analytics error:", err.message);
    return json({ success: false }, { headers: CORS_HEADERS });
  }
}