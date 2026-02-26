// ═══════════════════════════════════════════════════════════════
//  File: app/routes/api.animated-questions.$id.jsx
//
//  PUT    /api/animated-questions/:id  → update question
//  DELETE /api/animated-questions/:id  → delete question
//
//  ✅ FIX: loader added for OPTIONS preflight
// ═══════════════════════════════════════════════════════════════

import { data } from "react-router";
import {
  updateAnimatedQuestion,
  deleteAnimatedQuestion,
} from "../services.animatedQuestions";

const CORS = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ✅ loader REQUIRED
export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  return data({ ok: true }, { headers: CORS });
}

export async function action({ request, params }) {
  const { id } = params;
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const body     = await request.json().catch(() => ({}));
  const { shop } = body;

  if (!shop) {
    return data({ error: "shop is required" }, { status: 400, headers: CORS });
  }

  try {
    if (method === "DELETE") {
      const result = await deleteAnimatedQuestion(id, shop);
      return data(result, { headers: CORS });
    }

    if (method === "PUT") {
      const result = await updateAnimatedQuestion(id, shop, body);
      return data(result, { headers: CORS });
    }

    return data({ error: "Method not allowed" }, { status: 405, headers: CORS });

  } catch (err) {
    console.error("[AQ] $id action error:", err.message);
    const status = err.message === "Forbidden"          ? 403
                 : err.message === "Question not found" ? 404
                 : 500;
    return data({ error: err.message }, { status, headers: CORS });
  }
}