import { json } from "@remix-run/node";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return json({ error: "Missing shop parameter" }, { status: 400 });
  }

  try {
    const settings = await prisma.chatSettings.findUnique({
      where: { shop: shop },
    });

    const defaultSettings = {
      primaryColor: "#6366f1",
      headerBgColor: "#384959",
      welcomeImg: "https://ui-avatars.com/api/?name=Support&background=fff",
      headerTitle: "Live Support",
      headerSubtitle: "Online now",
      welcomeText: "Hi there 👋",
      welcomeSubtext: "We are here to help you! Ask us anything or browse our services.",
      startConversationText: "Start a conversation",
    };

    const responseData = settings || defaultSettings;

    return json(responseData, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        // 👇 Is line ko change kiya gaya hai taaki update instant dikhe
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  // Ensure shop is always set correctly from the session
  const shop = session.shop;

  await prisma.chatSettings.upsert({
    where: { shop: shop },
    update: { 
      ...data, 
      shop: shop // prevent accidental shop change
    },
    create: { 
      ...data, 
      shop: shop 
    },
  });

  return json({ success: true });
};