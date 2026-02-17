// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.admin.register-fcm-token.jsx
//  PATH: app/routes/app.admin.register-fcm-token.jsx
//
//  admin.jsx → POST /app/admin/register-fcm-token → yeh file
//  Admin ka FCM token type="admin" ke saath DB mein save karta hai
//  Yahi token app.push.send.jsx use karta hai push bhejne ke liye
// ═══════════════════════════════════════════════════════════

import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
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
    // Shopify admin authentication se shop lo
    let shop;
    try {
      const { session } = await authenticate.admin(request);
      shop = session.shop;
    } catch (_) {
      // Embedded app mein session header se nahi mila
      // Body se shop lo fallback ke taur pe
    }

    const body = await request.json();
    const { fcmToken, adminEmail } = body;

    // Fallback: body se shop lo agar session mein nahi mila
    if (!shop) shop = body.shop;

    if (!shop || !fcmToken) {
      return json(
        { success: false, error: "shop aur fcmToken required hain" },
        { status: 400, headers: corsHeaders }
      );
    }

    // FcmToken DB mein upsert — type: "admin"
    await prisma.fcmToken.upsert({
      where : { token: fcmToken },
      update: {
        shop,
        email    : adminEmail || null,
        updatedAt: new Date(),
      },
      create: {
        shop,
        token: fcmToken,
        type : "admin",
        email: adminEmail || null,
      },
    });

    console.log(`✅ Admin FCM token saved — shop: ${shop}`);
    return json({ success: true }, { headers: corsHeaders });

  } catch (error) {
    console.error("❌ admin register-fcm-token error:", error);
    return json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
};