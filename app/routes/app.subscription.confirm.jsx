// app/routes/app.subscription.confirm.jsx
import { redirect, json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  try {
    const { session, admin } = await authenticate.admin(request);
    const shop = session.shop;

    const url = new URL(request.url);
    const planKey = url.searchParams.get("plan");

    console.log("📋 Billing confirmation:", { shop, planKey });

    if (!planKey) {
      return redirect("/app/subscription?error=no-plan");
    }

    const subscription = await prisma.subscription.findUnique({
      where: { shop },
    });

    if (!subscription?.billingId) {
      return redirect("/app/subscription?error=no-subscription");
    }

    // 🔎 Verify subscription directly from Shopify
    const response = await admin.graphql(
      `#graphql
      query GetAppSubscription($id: ID!) {
        node(id: $id) {
          ... on AppSubscription {
            id
            status
            currentPeriodEnd
            trialDays
            test
          }
        }
      }`,
      {
        variables: { id: subscription.billingId },
      }
    );

    const result = await response.json();
    const appSubscription = result.data?.node;

    if (!appSubscription) {
      console.log("❌ Shopify verification failed");
      return redirect("/app/subscription?error=verification-failed");
    }

    console.log("✅ Shopify status:", appSubscription.status);

    // 🚨 If user cancelled billing approval
    if (appSubscription.status === "PENDING") {
      await prisma.subscription.update({
        where: { shop },
        data: {
          plan: "FREE",
          status: "active",
          billingId: null,
        },
      });

      return redirect("/app/subscription?billing=cancelled");
    }

    // ✅ If subscription approved
    if (
      appSubscription.status === "ACTIVE" ||
      appSubscription.status === "TRIALING"
    ) {
      await prisma.subscription.update({
        where: { shop },
        data: {
          plan: planKey,
          status:
            appSubscription.status === "TRIALING"
              ? "trialing"
              : "active",
          billingId: appSubscription.id,
          currentPeriodEnd: appSubscription.currentPeriodEnd
            ? new Date(appSubscription.currentPeriodEnd)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      console.log("🎉 Subscription activated:", planKey);

      // 🔥 IMPORTANT: Redirect to /app (forces layout reload)
     return redirect(
    `/app/subscription?success=true&plan=${planKey}`
  );
    }

    // ❌ Any other status (CANCELLED, EXPIRED, FROZEN)
    await prisma.subscription.update({
      where: { shop },
      data: {
        plan: "FREE",
        status: "active",
        billingId: null,
      },
    });

    return redirect("/app/subscription?error=confirmation-failed");

  } catch (error) {
    console.error("❌ Confirm error:", error);
    return redirect("/app/subscription?error=confirmation-failed");
  }
};
