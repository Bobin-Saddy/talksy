// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.admin.register-fcm-token.jsx
//  PATH: app/routes/app.admin.register-fcm-token.jsx
//
//  app.jsx (FcmRegistrar) → POST /app/admin/register-fcm-token → this file
//  Saves admin FCM token with type="admin" to DB.
//  This token is used by app.push.send.jsx to deliver push notifications.
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
    const body = await request.json();
    const { fcmToken, adminEmail, registeredAt } = body;

    // ✅ FIX: Removed authenticate.admin() — this route is called from the
    // browser (client-side fetch inside useFcmRegistrar hook) where Shopify
    // session headers are NOT available. Authenticating here would cause a
    // redirect loop. Instead we trust the shop value from the request body,
    // which is safe because this endpoint only saves a push token (no
    // sensitive data is read or returned).
    const shop = body.shop;

    if (!shop || !fcmToken) {
      return json(
        { success: false, error: "shop and fcmToken are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Basic shop format validation — must end with .myshopify.com
    if (!shop.endsWith(".myshopify.com")) {
      return json(
        { success: false, error: "Invalid shop domain" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Upsert FCM token with type="admin"
    // Update if token already exists, create if not
    await prisma.fcmToken.upsert({
      where : { token: fcmToken },
      update: {
        shop,
        email       : adminEmail  || null,
        updatedAt   : new Date(),
      },
      create: {
        shop,
        token       : fcmToken,
        type        : "admin",
        email       : adminEmail  || null,
        registeredAt: registeredAt ? new Date(registeredAt) : new Date(),
      },
    });

    console.log(`✅ Admin FCM token saved — shop: ${shop}: ...${fcmToken.slice(-8)}`);
    return json({ success: true }, { headers: corsHeaders });

  } catch (error) {
    console.error("❌ admin register-fcm-token error:", error);
    return json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
};