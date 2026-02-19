// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.chat.upload.jsx
//  FIX: All image formats supported (jpg, png, gif, webp, svg, bmp, heic)
// ═══════════════════════════════════════════════════════════

import { json } from "@remix-run/node";
import prisma from "../db.server";

const corsHeaders = {
  "Access-Control-Allow-Origin" : "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = () => json({}, { headers: corsHeaders });

// All supported mime types → file extensions
const MIME_TO_EXT = {
  "image/jpeg"   : "jpg",
  "image/jpg"    : "jpg",
  "image/png"    : "png",
  "image/gif"    : "gif",
  "image/webp"   : "webp",
  "image/svg+xml": "svg",
  "image/bmp"    : "bmp",
  "image/heic"   : "heic",
  "image/heif"   : "heif",
  "image/avif"   : "avif",
};

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { shop, sessionId, imageData, mimeType } = await request.json();

    if (!shop || !imageData) {
      return json({ success: false, error: "shop and imageData required" }, { status: 400, headers: corsHeaders });
    }

    // Strip data URL prefix: "data:image/png;base64,XXXX" → "XXXX"
    const base64 = imageData.includes(",") ? imageData.split(",")[1] : imageData;

    // Detect mime type from data URL or from passed mimeType
    const detectedMime = (imageData.match(/data:([^;]+);/) || [])[1] || mimeType || "image/jpeg";
    const ext = MIME_TO_EXT[detectedMime] || detectedMime.split("/")[1] || "jpg";

    const buffer   = Buffer.from(base64, "base64");
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const saved = await prisma.chatImage.create({
      data: {
        shop,
        sessionId: sessionId || null,
        filename,
        data    : buffer,
        mimeType: detectedMime,
      },
    });

    const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : "https://talksy-production-5d43.up.railway.app";

    const imageUrl = `${BASE_URL}/app/chat/image/${saved.id}`;

    console.log(`✅ Image uploaded: ${filename} (${detectedMime}) → ${imageUrl}`);
    return json({ success: true, imageUrl, id: saved.id }, { headers: corsHeaders });

  } catch (error) {
    console.error("❌ Upload error:", error);
    return json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
};