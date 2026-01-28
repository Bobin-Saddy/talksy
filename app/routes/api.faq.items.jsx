// app/routes/api.faq.items.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("action");

  try {
    switch (actionType) {
      case "create": {
        const categoryId = formData.get("categoryId");
        const question = formData.get("question");
        const answer = formData.get("answer");
        const icon = formData.get("icon") || "QuestionCircleIcon";
        const position = parseInt(formData.get("position") || "0");
        const isActive = formData.get("isActive") === "true";

        const faq = await prisma.faq.create({
          data: {
            shop,
            categoryId,
            question,
            answer,
            icon,
            position,
            isActive
          }
        });

        return json({ success: true, faq });
      }

      case "update": {
        const id = formData.get("id");
        const question = formData.get("question");
        const answer = formData.get("answer");
        const icon = formData.get("icon") || "QuestionCircleIcon";
        const isActive = formData.get("isActive") === "true";

        const faq = await prisma.faq.update({
          where: { id },
          data: { 
            question, 
            answer,
            icon,
            isActive
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

      case "toggleStatus": {
        const id = formData.get("id");
        const isActive = formData.get("isActive") === "true";

        const faq = await prisma.faq.update({
          where: { id },
          data: { isActive }
        });

        return json({ success: true, faq });
      }

      default:
        return json({ success: false, error: "Invalid action" });
    }
  } catch (error) {
    console.error("Error in FAQ items action:", error);
    return json({ success: false, error: error.message });
  }
}