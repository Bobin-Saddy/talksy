// app/routes/api.faq.categories.jsx
import { json } from "@remix-run/node";
import prisma from "../db.server";

export async function loader({ request }) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return json({ error: "Shop parameter required" }, { status: 400 });
  }

  try {
    const categories = await prisma.faqCategory.findMany({
      where: { shop },
      include: {
        faqs: {
          where: { isActive: true },
          orderBy: { position: "asc" }
        }
      },
      orderBy: { position: "asc" }
    });

    return json({ categories });
  } catch (error) {
    console.error("Error fetching FAQ categories:", error);
    return json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function action({ request }) {
  const formData = await request.formData();
  const action = formData.get("action");
  const shop = formData.get("shop");

  if (!shop) {
    return json({ error: "Shop parameter required" }, { status: 400 });
  }

  try {
    switch (action) {
      case "create": {
        const title = formData.get("title");
        const position = parseInt(formData.get("position") || "0");

        const category = await prisma.faqCategory.create({
          data: {
            shop,
            title,
            position
          }
        });

        return json({ success: true, category });
      }

      case "update": {
        const id = formData.get("id");
        const title = formData.get("title");
        const position = parseInt(formData.get("position") || "0");
        const isActive = formData.get("isActive") === "true";

        const category = await prisma.faqCategory.update({
          where: { id },
          data: { title, position, isActive }
        });

        return json({ success: true, category });
      }

      case "delete": {
        const id = formData.get("id");

        await prisma.faqCategory.delete({
          where: { id }
        });

        return json({ success: true });
      }

      case "reorder": {
        const updates = JSON.parse(formData.get("updates"));

        await Promise.all(
          updates.map((update) =>
            prisma.faqCategory.update({
              where: { id: update.id },
              data: { position: update.position }
            })
          )
        );

        return json({ success: true });
      }

      default:
        return json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in FAQ category action:", error);
    return json({ error: "Operation failed" }, { status: 500 });
  }
}