// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.chat.register-fcm-token.jsx
//  PATH: app/routes/app.chat.register-fcm-token.jsx
//
//  Liquid widget → POST /app/chat/register-fcm-token → this file
//  Saves customer FCM token to FcmToken DB table.
//  Completely separate from app.chat.register.jsx — that one
//  creates a ChatSession; this one only saves the FCM token.
// ═══════════════════════════════════════════════════════════

import { json } from "@remix-run/node";
import prisma from "../db.server";

const corsHeaders = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export const loader = () => json({}, { headers: corsHeaders });

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const {
      shop,
      fcmToken,
      sessionId,
      email,
      userAgent,
      registeredAt,
    } = await request.json();

    if (!shop || !fcmToken) {
      return json(
        { success: false, error: "shop and fcmToken are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Upsert FCM token — update if token already exists, create if not
    await prisma.fcmToken.upsert({
      where : { token: fcmToken },
      update: {
        shop,
        sessionId : sessionId  || null,
        email     : email      || null,
        userAgent : userAgent  || null,
        updatedAt : new Date(),
      },
      create: {
        shop,
        token       : fcmToken,
        type        : "customer",
        sessionId   : sessionId   || null,
        email       : email       || null,
        userAgent   : userAgent   || null,
        registeredAt: registeredAt ? new Date(registeredAt) : new Date(),
      },
    });

    console.log(`✅ Customer FCM token saved — shop: ${shop}, email: ${email || "anonymous"}`);
    return json({ success: true }, { headers: corsHeaders });

  } catch (error) {
    console.error("❌ register-fcm-token error:", error);
    return json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
};