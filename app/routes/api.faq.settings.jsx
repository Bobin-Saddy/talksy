// app/routes/api.faq.settings.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const data = await request.json();
    
    // Remove shop from data before upserting
    const { shop: _, ...settingsData } = data;

    const settings = await prisma.faqPageSettings.upsert({
      where: { shop },
      update: settingsData,
      create: {
        shop,
        ...settingsData
      }
    });

    return json({ success: true, settings });
  } catch (error) {
    console.error("Error saving settings:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}