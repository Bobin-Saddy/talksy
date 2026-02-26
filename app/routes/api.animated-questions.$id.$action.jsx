// ═══════════════════════════════════════════════════════════════
//  File: app/routes/api.animated-questions.$id.$action.jsx
//
//  POST /api/animated-questions/:id/click   → track click
//  POST /api/animated-questions/:id/dismiss → track dismiss
//
//  ✅ FIX: loader added for OPTIONS preflight handling
//     React Router v7 requires loader to handle OPTIONS requests
// ═══════════════════════════════════════════════════════════════

import { data } from "react-router";
import {
  trackQuestionClick,
  trackQuestionDismiss,
} from "../services.animatedQuestions";

const CORS = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ✅ loader REQUIRED — React Router OPTIONS preflight yahan aata hai
export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  return data({ ok: true }, { headers: CORS });
}

export async function action({ request, params }) {
  const { id, action: actionType } = params;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    if (actionType === "click") {
      const result = await trackQuestionClick(id);
      return data(result, { headers: CORS });
    }

    if (actionType === "dismiss") {
      const result = await trackQuestionDismiss(id);
      return data(result, { headers: CORS });
    }

    return data({ error: "Unknown action" }, { status: 400, headers: CORS });

  } catch (err) {
    console.error("[AQ] analytics error:", err.message);
    return data({ success: false }, { headers: CORS });
  }
}