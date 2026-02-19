// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.admin.register-fcm-token.jsx
//  FIX: Removed "registeredAt" — field does not exist in FcmToken schema.
//       Prisma uses "createdAt" (auto-managed). Passing registeredAt
//       caused a PrismaClientValidationError → 500 → token never saved
//       → "No admin FCM tokens found" on every push.
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
    const { fcmToken, adminEmail } = body;
    const shop = body.shop;

    if (!shop || !fcmToken) {
      return json(
        { success: false, error: "shop and fcmToken are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!shop.endsWith(".myshopify.com")) {
      return json(
        { success: false, error: "Invalid shop domain" },
        { status: 400, headers: corsHeaders }
      );
    }

    // ✅ FIX: No "registeredAt" — not in schema.
    // Prisma handles "createdAt" and "updatedAt" automatically.
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

    console.log(`✅ Admin FCM token saved — shop: ${shop}, token: ...${fcmToken.slice(-8)}`);
    return json({ success: true }, { headers: corsHeaders });

  } catch (error) {
    console.error("❌ admin register-fcm-token error:", error);
    return json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
};