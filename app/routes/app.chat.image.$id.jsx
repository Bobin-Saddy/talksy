// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.chat.image.$id.jsx
//  URL:  GET /app/chat/image/:id
//  Serves uploaded images from DB — must be publicly accessible
//  so FCM can fetch the image to display in notifications
// ═══════════════════════════════════════════════════════════

import prisma from "../db.server";

export const loader = async ({ params }) => {
  const { id } = params;

  // Must return proper CORS headers so FCM servers can fetch the image
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control"              : "public, max-age=31536000, immutable",
    "X-Content-Type-Options"     : "nosniff",
  };

  try {
    const image = await prisma.chatImage.findUnique({
      where : { id: parseInt(id) },
      select: { data: true, mimeType: true, filename: true },
    });

    if (!image) {
      return new Response("Image not found", { status: 404, headers });
    }

    return new Response(image.data, {
      status : 200,
      headers: {
        ...headers,
        "Content-Type"       : image.mimeType || "image/jpeg",
        "Content-Disposition": `inline; filename="${image.filename}"`,
        "Content-Length"     : image.data.length.toString(),
      },
    });

  } catch (error) {
    console.error("❌ Image serve error:", error);
    return new Response("Error serving image", { status: 500, headers });
  }
};