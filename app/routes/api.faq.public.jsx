// app/routes/api.faq.public.jsx - Public FAQ API (No Auth Required)
import { json } from "@remix-run/node";
import prisma from "../db.server";

// Enable CORS for this route
export async function loader({ request }) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (!shop) {
    return json(
      { success: false, error: "Shop parameter required" },
      {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
        },
      }
    );
  }

  try {
    const categories = await prisma.faqCategory.findMany({
      where: { 
        shop,
        isActive: true 
      },
      include: {
        faqs: {
          where: { isActive: true },
          orderBy: { position: "asc" }
        }
      },
      orderBy: { position: "asc" }
    });

    return json(
      { 
        success: true, 
        categories 
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Cache-Control": "public, max-age=300", // Cache for 5 minutes
        },
      }
    );
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    return json(
      { 
        success: false, 
        error: error.message,
        categories: [] 
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
        },
      }
    );
  }
}