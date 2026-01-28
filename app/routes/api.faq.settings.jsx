// app/routes/api.faq.settings.jsx
import { json } from "@remix-run/node";
import prisma from "../db.server";

/**
 * CORS helper
 */
function cors(data, status = 200, request) {
  const origin = request?.headers.get("Origin") || "*";

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/**
 * Preflight request handler
 */
export function options({ request }) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/**
 * GET: Fetch FAQ Page Settings
 */
export async function loader({ request }) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return cors({ error: "Shop parameter required" }, 400, request);
  }

  try {
    let settings = await prisma.faqPageSettings.findFirst({
      where: { shop }
    });

    // Create default settings if not exists
    if (!settings) {
      settings = await prisma.faqPageSettings.create({
        data: {
          shop,
          layout: "list",
          appearanceTheme: "light",
          customBackgroundColor: "#FFFFFF",
          customTextColor: "#000000",
          customAccentColor: "#5C6AC4",
          customBorderRadius: 8,
          headerEnabled: true,
          headerTitle: "Frequently Asked Questions",
          headerDescription: "Got a question? We are here to answer!",
          headerAlignment: "center",
          searchEnabled: true,
          searchPlaceholder: "Search FAQs...",
          showIcons: true,
          showCategories: true,
          enableAccordion: true,
          faqSpacing: "comfortable",
          contactFormEnabled: false,
          contactFormTitle: "Can't find what you're looking for?",
          contactFormDescription: "Send us a message and we'll get back to you soon",
          contactFormEmailLabel: "Your Email",
          contactFormEmailPlaceholder: "you@example.com",
          contactFormMessageLabel: "Message",
          contactFormMessagePlaceholder: "How can we help?",
          contactFormButtonText: "Send Message",
          customCSS: ""
        }
      });
    }

    return cors({ settings }, 200, request);
  } catch (error) {
    console.error("Error fetching FAQ settings:", error);
    return cors({ error: "Failed to fetch settings" }, 500, request);
  }
}

/**
 * POST: Update FAQ Page Settings
 */
export async function action({ request }) {
  try {
    const body = await request.json();
    const { shop, ...settingsData } = body;

    if (!shop) {
      return cors({ error: "Shop parameter required" }, 400, request);
    }

    // Upsert settings
    const settings = await prisma.faqPageSettings.upsert({
      where: { shop },
      update: settingsData,
      create: {
        shop,
        ...settingsData
      }
    });

    return cors({ success: true, settings }, 200, request);
  } catch (error) {
    console.error("Error saving FAQ settings:", error);
    return cors({ error: "Failed to save settings" }, 500, request);
  }
}