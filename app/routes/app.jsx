// app/routes/app.jsx - FIXED: Nav items show immediately after plan selection
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider, Badge } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import { authenticate } from "../shopify.server";
import { useEffect } from "react";
import { getUsageStats } from "../planLimits.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // ✅ FIXED: Use upsert so subscription always exists from first load
  const subscription = await prisma.subscription.upsert({
    where: { shop },
    update: {},
    create: {
      shop,
      plan: "FREE",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  // Get usage statistics with error handling
  let usage = null;
  try {
    usage = await getUsageStats(shop);
  } catch (error) {
    console.error("Error getting usage stats:", error);
    usage = {
      plan: subscription.plan || "FREE",
      chats: {
        current: 0,
        max: 100,
        percentage: 0,
        remaining: 100,
      },
      faqs: {
        current: 0,
        canManage: false,
      },
      features: {
        canCustomizeWidget: false,
        canCreateCustomFAQPage: false,
      },
      retention: {
        days: 30,
      },
    };
  }

  // ✅ FIXED: Read plan directly from DB subscription (source of truth)
  // Don't rely on usage.plan alone — subscription.plan is always fresh from DB
  const currentPlan = subscription.plan || "FREE";
  const currentStatus = subscription.status || "active";

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    usage,
    subscriptionStatus: currentStatus,
    currentPlan, // ✅ Pass plan directly so nav doesn't depend on usage object timing
  };
};

export default function App() {
  const { apiKey, usage, subscriptionStatus, currentPlan } = useLoaderData();

  const isApproachingLimit =
    usage &&
    typeof usage.chats.percentage === "number" &&
    usage.chats.percentage > 80;
  const isAtLimit =
    usage &&
    typeof usage.chats.percentage === "number" &&
    usage.chats.percentage >= 100;

  // ✅ FIXED: Use currentPlan from DB directly for nav visibility
  // This ensures nav items appear immediately after plan selection
  const isBillingApproved =
    subscriptionStatus === "active" || subscriptionStatus === "trialing";

  // ✅ FIXED: Check plan from currentPlan (DB value), not usage.plan
  const isPaidPlan =
    (currentPlan === "STANDARD" || currentPlan === "PREMIUM") &&
    isBillingApproved;

  const canManageFAQs =
    (currentPlan === "STANDARD" || currentPlan === "PREMIUM") &&
    isBillingApproved;

  const canCustomizeWidget =
    (currentPlan === "STANDARD" || currentPlan === "PREMIUM") &&
    isBillingApproved;

  // Search Analytics — paid plans only
  const canViewSearchAnalytics = isPaidPlan;

  // Heartbeat Logic
  useEffect(() => {
    const updateHeartbeat = async () => {
      try {
        await fetch("/app/update-status", { method: "POST" });
        console.log("Admin Heartbeat updated");
      } catch (err) {
        console.error("Heartbeat error:", err);
      }
    };

    updateHeartbeat();
    const interval = setInterval(updateHeartbeat, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ShopifyAppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={enTranslations}>
        <s-app-nav>
          <s-link href="/app/chat/admin">Chats</s-link>

          {/* ✅ Search — visible immediately after Standard/Premium plan activation */}
          {canViewSearchAnalytics && (
            <s-link href="/app/admin/search">Search</s-link>
          )}

          {/* ✅ Settings — visible immediately after paid plan activation */}
          {canCustomizeWidget && (
            <s-link href="/app/settings">Settings</s-link>
          )}

          {/* ✅ FAQs — visible immediately after paid plan activation */}
          {canManageFAQs && (
            <s-link href="/app/faq">FAQs</s-link>
          )}

          <s-link href="/app/subscription">
            Subscription
            {usage &&
              isApproachingLimit &&
              !isAtLimit &&
              usage.chats.remaining !== "Unlimited" && (
                <span style={{ marginLeft: "8px" }}>
                  <Badge tone="warning">{usage.chats.remaining} left</Badge>
                </span>
              )}
            {usage && isAtLimit && (
              <span style={{ marginLeft: "8px" }}>
                <Badge tone="critical">Limit Reached</Badge>
              </span>
            )}
            {subscriptionStatus === "pending_approval" && (
              <span style={{ marginLeft: "8px" }}>
                <Badge tone="info">Pending</Badge>
              </span>
            )}
          </s-link>
        </s-app-nav>

        {/* Pending billing banner */}
        {subscriptionStatus === "pending_approval" && (
          <div
            style={{
              padding: "12px 20px",
              backgroundColor: "#E3F2FD",
              borderBottom: "1px solid #90CAF9",
              textAlign: "center",
            }}
          >
            <span style={{ fontWeight: 600 }}>
              ⏳ Your subscription upgrade is pending billing approval.
            </span>{" "}
            <a
              href="/app/subscription"
              style={{ color: "#005BD3", textDecoration: "underline" }}
            >
              Complete billing approval
            </a>
          </div>
        )}

        {/* Approaching / at limit banner */}
        {usage && (isApproachingLimit || isAtLimit) && isBillingApproved && (
          <div
            style={{
              padding: "12px 20px",
              backgroundColor: isAtLimit ? "#FED3D1" : "#FFF4E5",
              borderBottom: "1px solid #ddd",
              textAlign: "center",
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {isAtLimit
                ? `⚠️ You've reached your ${currentPlan} plan limit (${usage.chats.current}/${usage.chats.max} chats).`
                : `⚡ You're using ${Math.round(usage.chats.percentage)}% of your ${currentPlan} plan.`}
            </span>{" "}
            <a
              href="/app/subscription"
              style={{ color: "#005BD3", textDecoration: "underline" }}
            >
              {isAtLimit ? "Upgrade now to continue" : "Upgrade your plan"}
            </a>
          </div>
        )}

        <Outlet />
      </PolarisAppProvider>
    </ShopifyAppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};