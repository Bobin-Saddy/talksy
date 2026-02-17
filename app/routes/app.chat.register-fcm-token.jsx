// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.chat.register-fcm-token.jsx
//  PATH: app/routes/app.chat.register-fcm-token.jsx
//
//  Liquid widget → POST /app/chat/register-fcm-token → yeh file
//  Customer ka FCM token FcmToken DB mein save karta hai
//  Existing app.chat.register.jsx se bilkul alag hai — woh
//  ChatSession banata hai, yeh sirf FCM token save karta hai
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
        { success: false, error: "shop aur fcmToken required hain" },
        { status: 400, headers: corsHeaders }
      );
    }

    // FcmToken DB mein upsert karo
    // (agar same token pehle se hai toh update, nahi toh create)
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
        token    : fcmToken,
        type     : "customer",
        sessionId: sessionId  || null,
        email    : email      || null,
        userAgent: userAgent  || null,
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










