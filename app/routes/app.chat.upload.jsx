// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.chat.upload.jsx
//  PURPOSE: Convert base64 image → store as Buffer in DB
//           and return a permanent HTTPS URL that FCM can use
//           in push notification image field.
//
//  FLOW:
//  Widget sends base64 → POST /app/chat/upload
//  → Saves to ChatImage table → Returns HTTPS URL
//  → Widget sends HTTPS URL as fileUrl in message
//  → FCM notification shows real image ✅
// ═══════════════════════════════════════════════════════════

import { json } from "@remix-run/node";
import prisma from "../db.server";

const corsHeaders = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = () => json({}, { headers: corsHeaders });

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { shop, sessionId, imageData, mimeType } = await request.json();

    if (!shop || !imageData) {
      return json({ success: false, error: "shop and imageData required" }, { status: 400, headers: corsHeaders });
    }

    // Strip data URL prefix if present: "data:image/png;base64,..."
    const base64 = imageData.includes(",") ? imageData.split(",")[1] : imageData;
    const mime   = mimeType || (imageData.match(/data:([^;]+);/) || [])[1] || "image/jpeg";
    const ext    = mime.split("/")[1]?.replace("jpeg", "jpg") || "jpg";

    // Convert base64 → Buffer and save to DB
    const buffer   = Buffer.from(base64, "base64");
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Save image to ChatImage table
    // Schema: id, shop, sessionId, filename, data (Bytes), mimeType, createdAt
    const saved = await prisma.chatImage.create({
      data: {
        shop,
        sessionId: sessionId || null,
        filename,
        data    : buffer,
        mimeType: mime,
      },
    });

    // Return permanent HTTPS URL pointing to the serve endpoint
    const BASE_URL = "https://talksy-production-5d43.up.railway.app";
    const imageUrl = `${BASE_URL}/app/chat/image/${saved.id}`;

    console.log(`✅ Image uploaded: ${filename} → ${imageUrl}`);
    return json({ success: true, imageUrl, id: saved.id }, { headers: corsHeaders });

  } catch (error) {
    console.error("❌ Upload error:", error);
    return json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
};