// app/routes/api.faq.categories.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const categories = await prisma.faqCategory.findMany({
      where: { shop },
      include: {
        faqs: {
          orderBy: { position: "asc" }
        }
      },
      orderBy: { position: "asc" }
    });

    return json({ success: true, categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const formData = await request.formData();
    const action = formData.get("action");

    switch (action) {
      case "create": {
        const title = formData.get("title");
        const position = parseInt(formData.get("position") || "0");

        const category = await prisma.faqCategory.create({
          data: {
            shop,
            title,
            position,
            isActive: true
          }
        });

        return json({ success: true, category });
      }

      case "update": {
        const id = formData.get("id");
        const title = formData.get("title");

        const category = await prisma.faqCategory.update({
          where: { id },
          data: { title }
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
          updates.map(update =>
            prisma.faqCategory.update({
              where: { id: update.id },
              data: { position: update.position }
            })
          )
        );

        return json({ success: true });
      }

      case "toggle": {
        const id = formData.get("id");
        const isActive = formData.get("isActive") === "true";

        const category = await prisma.faqCategory.update({
          where: { id },
          data: { isActive }
        });

        return json({ success: true, category });
      }

      default:
        return json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in category action:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}