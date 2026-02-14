// app/routes/app.jsx - WITH BLUR OVERLAY FOR LOCKED FEATURES
import { Outlet, useLoaderData, useRouteError, useLocation } from "react-router";
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
  
  // ✅ Get subscription status to check if billing is approved
  const subscription = await prisma.subscription.findUnique({
    where: { shop },
  });
  
  // Get usage statistics with error handling
  let usage = null;
  try {
    usage = await getUsageStats(shop);
  } catch (error) {
    console.error("Error getting usage stats:", error);
    usage = {
      plan: "FREE",
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
  
  return { 
    apiKey: process.env.SHOPIFY_API_KEY || "",
    usage,
    subscriptionStatus: subscription?.status || "active",
  };
};

// ✅ Blur Overlay Component for Locked Pages
function LockedPageOverlay({ requiredPlan, currentPlan, isPendingApproval }) {
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{
        background: "white",
        borderRadius: "12px",
        padding: "40px",
        maxWidth: "500px",
        textAlign: "center",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
        border: "1px solid #e1e3e5",
      }}>
        <div style={{ fontSize: "64px", marginBottom: "20px" }}>🔒</div>
        <h2 style={{ 
          fontSize: "24px", 
          fontWeight: "600", 
          marginBottom: "12px",
          color: "#202223"
        }}>
          {isPendingApproval ? "Billing Approval Required" : `Activate Your ${requiredPlan} Plan`}
        </h2>
        <p style={{ 
          fontSize: "16px", 
          color: "#6d7175", 
          marginBottom: "24px",
          lineHeight: "1.6"
        }}>
          {isPendingApproval ? (
            <>
              Your subscription upgrade is pending billing approval. 
              Complete the billing process to access this feature.
            </>
          ) : (
            <>
              This feature is available on the <strong>{requiredPlan}</strong> plan or higher.
              {currentPlan === "FREE" && " Upgrade now to unlock this feature."}
            </>
          )}
        </p>
        <a 
          href="/app/subscription"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            backgroundColor: "#005BD3",
            color: "white",
            textDecoration: "none",
            borderRadius: "8px",
            fontWeight: "600",
            fontSize: "16px",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = "#004FC4"}
          onMouseLeave={(e) => e.target.style.backgroundColor = "#005BD3"}
        >
          {isPendingApproval ? "Complete Billing Approval" : "View Plans"}
        </a>
      </div>
    </div>
  );
}

export default function App() {
  const { apiKey, usage, subscriptionStatus } = useLoaderData();
  const location = useLocation();
  
  // Calculate if user is approaching limit
  const isApproachingLimit = usage && typeof usage.chats.percentage === 'number' && usage.chats.percentage > 80;
  const isAtLimit = usage && typeof usage.chats.percentage === 'number' && usage.chats.percentage >= 100;

  // ✅ Check if billing is approved
  const isBillingApproved = subscriptionStatus === "active" || subscriptionStatus === "trialing";
  const isPendingApproval = subscriptionStatus === "pending_approval";
  
  // Check plan permissions
  const isPaidPlan = usage && (usage.plan === "STANDARD" || usage.plan === "PREMIUM") && isBillingApproved;
  const canManageFAQs = usage && usage.faqs.canManage && isBillingApproved;
  const canCustomizeWidget = usage && usage.features.canCustomizeWidget && isBillingApproved;
  
  // ✅ Determine if current page should be locked
  const currentPath = location.pathname;
  let isPageLocked = false;
  let requiredPlan = "";
  
  // Check if on Search page (requires STANDARD or PREMIUM + billing approved)
  if (currentPath.includes("/admin/search")) {
    isPageLocked = !isPaidPlan;
    requiredPlan = "Standard";
  }
  
  // Check if on Settings page (requires STANDARD or PREMIUM + billing approved)
  if (currentPath.includes("/settings")) {
    isPageLocked = !canCustomizeWidget;
    requiredPlan = "Standard";
  }
  
  // Check if on FAQ page (requires STANDARD or PREMIUM + billing approved)
  if (currentPath.includes("/faq")) {
    isPageLocked = !canManageFAQs;
    requiredPlan = "Standard";
  }

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
          
          {/* ✅ Show navigation but with lock icon if not accessible */}
          <s-link href="/app/admin/search">
            Search {!isPaidPlan && "🔒"}
          </s-link>
          
          <s-link href="/app/settings">
            Settings {!canCustomizeWidget && "🔒"}
          </s-link>
          
          <s-link href="/app/faq">
            FAQs {!canManageFAQs && "🔒"}
          </s-link>
          
          <s-link href="/app/subscription">
            Subscription
            {usage && isApproachingLimit && !isAtLimit && usage.chats.remaining !== "Unlimited" && (
              <span style={{ marginLeft: "8px" }}>
                <Badge tone="warning">
                  {usage.chats.remaining} left
                </Badge>
              </span>
            )}
            {usage && isAtLimit && (
              <span style={{ marginLeft: "8px" }}>
                <Badge tone="critical">Limit Reached</Badge>
              </span>
            )}
            {isPendingApproval && (
              <span style={{ marginLeft: "8px" }}>
                <Badge tone="info">Pending</Badge>
              </span>
            )}
          </s-link>
        </s-app-nav>
        
        {/* Show banner if billing is pending approval */}
        {isPendingApproval && (
          <div style={{ 
            padding: "12px 20px", 
            backgroundColor: "#E3F2FD",
            borderBottom: "1px solid #90CAF9",
            textAlign: "center"
          }}>
            <span style={{ fontWeight: 600 }}>
              ⏳ Your subscription upgrade is pending billing approval.
            </span>
            {" "}
            <a href="/app/subscription" style={{ color: "#005BD3", textDecoration: "underline" }}>
              Complete billing approval
            </a>
          </div>
        )}
        
        {/* Show banner if approaching or at limit */}
        {usage && (isApproachingLimit || isAtLimit) && isBillingApproved && (
          <div style={{ 
            padding: "12px 20px", 
            backgroundColor: isAtLimit ? "#FED3D1" : "#FFF4E5",
            borderBottom: "1px solid #ddd",
            textAlign: "center"
          }}>
            <span style={{ fontWeight: 600 }}>
              {isAtLimit 
                ? `⚠️ You've reached your ${usage.plan} plan limit (${usage.chats.current}/${usage.chats.max} chats).` 
                : `⚡ You're using ${Math.round(usage.chats.percentage)}% of your ${usage.plan} plan.`}
            </span>
            {" "}
            <a href="/app/subscription" style={{ color: "#005BD3", textDecoration: "underline" }}>
              {isAtLimit ? "Upgrade now to continue" : "Upgrade your plan"}
            </a>
          </div>
        )}
        
        {/* ✅ Main Content Area - with blur overlay if page is locked */}
        <div style={{ position: "relative" }}>
          {isPageLocked && (
            <LockedPageOverlay 
              requiredPlan={requiredPlan} 
              currentPlan={usage?.plan || "FREE"}
              isPendingApproval={isPendingApproval}
            />
          )}
          <div style={{ 
            filter: isPageLocked ? "blur(4px)" : "none",
            pointerEvents: isPageLocked ? "none" : "auto",
            userSelect: isPageLocked ? "none" : "auto"
          }}>
            <Outlet />
          </div>
        </div>
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