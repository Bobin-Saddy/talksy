// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.chat.image.$id.jsx
//  PURPOSE: Serve uploaded images from DB as HTTPS responses
//  URL: /app/chat/image/:id
// ═══════════════════════════════════════════════════════════

import prisma from "../db.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=31536000, immutable",
};

export const loader = async ({ params }) => {
  const { id } = params;

  try {
    const image = await prisma.chatImage.findUnique({
      where : { id: parseInt(id) },
      select: { data: true, mimeType: true, filename: true },
    });

    if (!image) {
      return new Response("Image not found", { status: 404 });
    }

    return new Response(image.data, {
      status : 200,
      headers: {
        ...corsHeaders,
        "Content-Type"       : image.mimeType || "image/jpeg",
        "Content-Disposition": `inline; filename="${image.filename}"`,
      },
    });
  } catch (error) {
    console.error("❌ Image serve error:", error);
    return new Response("Error", { status: 500 });
  }
};