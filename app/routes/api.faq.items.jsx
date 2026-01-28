// app/routes/api.faq.items.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const formData = await request.formData();
    const action = formData.get("action");

    switch (action) {
      case "create": {
        const categoryId = formData.get("categoryId");
        const question = formData.get("question");
        const answer = formData.get("answer");
        const icon = formData.get("icon") || "QuestionCircleIcon";
        const position = parseInt(formData.get("position") || "0");

        const faq = await prisma.faq.create({
          data: {
            shop,
            categoryId,
            question,
            answer,
            icon,
            position,
            isActive: true
          }
        });

        return json({ success: true, faq });
      }

      case "update": {
        const id = formData.get("id");
        const question = formData.get("question");
        const answer = formData.get("answer");
        const icon = formData.get("icon");

        const faq = await prisma.faq.update({
          where: { id },
          data: {
            question,
            answer,
            icon
          }
        });

        return json({ success: true, faq });
      }

      case "delete": {
        const id = formData.get("id");

        await prisma.faq.delete({
          where: { id }
        });

        return json({ success: true });
      }

      case "reorder": {
        const updates = JSON.parse(formData.get("updates"));

        await Promise.all(
          updates.map(update =>
            prisma.faq.update({
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

        const faq = await prisma.faq.update({
          where: { id },
          data: { isActive }
        });

        return json({ success: true, faq });
      }

      default:
        return json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in FAQ action:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}