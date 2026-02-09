// app/routes/app.subscription.confirm.jsx - COMPLETE FIXED VERSION
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  try {
    const { session, admin } = await authenticate.admin(request);
    const shop = session.shop;

    const url = new URL(request.url);
    const planKey = url.searchParams.get("plan");
    const charge_id = url.searchParams.get("charge_id");

    console.log("📋 Billing confirmation received:", { shop, planKey, charge_id });

    if (!planKey) {
      console.error("❌ No plan specified in confirmation");
      return redirect("/app/subscription?error=no-plan");
    }

    const subscription = await prisma.subscription.findUnique({
      where: { shop },
    });

    if (!subscription || !subscription.billingId) {
      console.error("❌ No pending subscription found");
      return redirect("/app/subscription?error=no-subscription");
    }

    const response = await admin.graphql(
      `#graphql
      query GetAppSubscription($id: ID!) {
        node(id: $id) {
          ... on AppSubscription {
            id
            name
            status
            currentPeriodEnd
            trialDays
            test
          }
        }
      }`,
      {
        variables: {
          id: subscription.billingId,
        },
      }
    );

    const result = await response.json();
    const appSubscription = result.data?.node;

    if (!appSubscription) {
      console.error("❌ Could not retrieve subscription from Shopify");
      return redirect("/app/subscription?error=verification-failed");
    }

    console.log("✅ Subscription verified:", appSubscription);

    const statusMap = {
      ACTIVE: "active",
      PENDING: "pending",
      CANCELLED: "cancelled",
      EXPIRED: "expired",
      FROZEN: "frozen",
    };

    const status = statusMap[appSubscription.status] || "pending";

    await prisma.subscription.update({
      where: { shop },
      data: {
        plan: planKey,
        status: status,
        billingId: appSubscription.id,
        currentPeriodEnd: appSubscription.currentPeriodEnd 
          ? new Date(appSubscription.currentPeriodEnd)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    console.log(`✅ Subscription confirmed for ${shop}: ${planKey} (${status})`);

    return redirect(`/app/subscription?success=true&plan=${planKey}`);

  } catch (error) {
    console.error("❌ Error confirming subscription:", error);
    return redirect("/app/subscription?error=confirmation-failed");
  }
};

export default function SubscriptionConfirm() {
  return null;
}