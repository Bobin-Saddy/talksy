// app/routes/app.subscription.confirm.jsx - FIXED WITH APP BRIDGE
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "react-router";
import { useEffect } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";


export const loader = async ({ request }) => {
  try {
    const { session, admin } = await authenticate.admin(request);
    const shop = session.shop;

    // Get the plan from URL params
    const url = new URL(request.url);
    const planKey = url.searchParams.get("plan");
    const charge_id = url.searchParams.get("charge_id");

    console.log("📋 Billing confirmation received:", { shop, planKey, charge_id });

    if (!planKey) {
      console.error("❌ No plan specified in confirmation");
      return json({ 
        error: "no-plan",
        redirect: "/app/subscription?error=no-plan"
      });
    }

    // Get the current subscription from database
    const subscription = await prisma.subscription.findUnique({
      where: { shop },
    });

    if (!subscription || !subscription.billingId) {
      console.error("❌ No pending subscription found");
      return json({ 
        error: "no-subscription",
        redirect: "/app/subscription?error=no-subscription"
      });
    }

    // Query Shopify to get the subscription status
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
      return json({ 
        error: "verification-failed",
        redirect: "/app/subscription?error=verification-failed"
      });
    }

    console.log("✅ Subscription verified:", appSubscription);

    // Map Shopify status to our status
    const statusMap = {
      ACTIVE: "active",
      PENDING: "pending",
      CANCELLED: "cancelled",
      EXPIRED: "expired",
      FROZEN: "frozen",
    };

    const status = statusMap[appSubscription.status] || "pending";

    // Update subscription without trialDays
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

    // ✅ FIXED: Use parentheses instead of backticks
    console.log(`✅ Subscription confirmed for ${shop}: ${planKey} (${status})`);

    // Return success for client-side redirect
    return json({ 
      success: true,
      redirect: `/app/subscription?success=true&plan=${planKey}`
    });

  } catch (error) {
    console.error("❌ Error confirming subscription:", error);
    return json({ 
      error: "confirmation-failed",
      redirect: "/app/subscription?error=confirmation-failed"
    });
  }
};

export default function SubscriptionConfirm() {
  const data = useLoaderData();
  const navigate = useNavigate();

  useEffect(() => {
    if (data?.redirect) {
      // Use navigate for embedded app context
      navigate(data.redirect);
    }
  }, [data, navigate]);

  return null;
}