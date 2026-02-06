// app/routes/app.subscription.confirm.jsx
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = session.shop;
  
  const url = new URL(request.url);
  const plan = url.searchParams.get("plan");
  const charge_id = url.searchParams.get("charge_id");

  if (!plan || !charge_id) {
    return redirect("/app/subscription?error=invalid_callback");
  }

  try {
    // Verify the billing charge with Shopify
    const billingCheck = await billing.check({
      plans: [plan],
      isTest: true, // Set to false in production
    });

    if (billingCheck.appSubscriptions.length > 0) {
      const subscription = billingCheck.appSubscriptions[0];
      
      // Update subscription in database
      await prisma.subscription.update({
        where: { shop },
        data: {
          plan: plan,
          status: subscription.status === "ACTIVE" ? "active" : "trialing",
          billingId: charge_id,
          currentPeriodStart: new Date(subscription.currentPeriodEnd),
          currentPeriodEnd: new Date(subscription.currentPeriodEnd),
          trialEndsAt: subscription.trialEndsOn ? new Date(subscription.trialEndsOn) : null,
        },
      });

      return redirect("/app/subscription?success=upgraded");
    } else {
      return redirect("/app/subscription?error=billing_failed");
    }
  } catch (error) {
    console.error("Billing confirmation error:", error);
    return redirect("/app/subscription?error=confirmation_failed");
  }
};