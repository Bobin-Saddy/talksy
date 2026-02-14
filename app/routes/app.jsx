// app/routes/app.jsx - WITH BLUR OVERLAY FOR LOCKED FEATURES
import { Outlet, useLoaderData, useRouteError, useLocation, useNavigate, useRevalidator } from "react-router";
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
function LockedPageOverlay({ requiredPlan, currentPlan, isPendingApproval, onNavigate }) {
  return (
    <div style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(255, 255, 255, 0.85)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{
        background: "white",
        borderRadius: "16px",
        padding: "48px 40px",
        maxWidth: "520px",
        textAlign: "center",
        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
        border: "2px solid #e1e3e5",
      }}>
        <div style={{ fontSize: "72px", marginBottom: "20px", lineHeight: 1 }}>🔒</div>
        <h2 style={{ 
          fontSize: "26px", 
          fontWeight: "700", 
          marginBottom: "12px",
          color: "#202223",
          lineHeight: "1.3"
        }}>
          {isPendingApproval ? "Billing Approval Required" : `Activate Your ${requiredPlan} Plan`}
        </h2>
        <p style={{ 
          fontSize: "16px", 
          color: "#6d7175", 
          marginBottom: "28px",
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
        <button
          onClick={() => onNavigate("/app/subscription")}
          style={{
            display: "inline-block",
            padding: "14px 32px",
            backgroundColor: "#005BD3",
            color: "white",
            textDecoration: "none",
            borderRadius: "8px",
            fontWeight: "600",
            fontSize: "16px",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 8px rgba(0, 91, 211, 0.3)",
            border: "none",
            cursor: "pointer"
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = "#004FC4";
            e.target.style.transform = "translateY(-1px)";
            e.target.style.boxShadow = "0 4px 12px rgba(0, 91, 211, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = "#005BD3";
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 2px 8px rgba(0, 91, 211, 0.3)";
          }}
        >
          {isPendingApproval ? "Complete Billing Approval" : "View Plans"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { apiKey, usage, subscriptionStatus } = useLoaderData();
  const location = useLocation();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  
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

  // ✅ Check if we're loading after billing approval
  const params = new URLSearchParams(location.search);
  const isBillingComplete = params.get('billing') === 'complete';
  const isRefreshing = revalidator.state === 'loading' && isBillingComplete;

  // ✅ Auto-refresh data when coming back from subscription page
  useEffect(() => {
    const hasSuccess = params.get('success') === 'true';
    const hasBillingComplete = params.get('billing') === 'complete';
    
    if (hasSuccess || hasBillingComplete) {
      console.log("✅ Billing approved - revalidating data...");
      // Immediately revalidate
      revalidator.revalidate();
      
      // Force full page reload after short delay to ensure fresh data
      setTimeout(() => {
        console.log("🔄 Force reload for immediate unlock");
        const cleanUrl = window.location.pathname;
        window.location.href = cleanUrl;
      }, 1500);
    }
  }, [location.search, revalidator]);

  // ✅ Periodic revalidation when pending approval
  useEffect(() => {
    if (isPendingApproval) {
      console.log("⏳ Pending approval - will check every 5 seconds");
      const interval = setInterval(() => {
        console.log("🔄 Checking for billing approval...");
        revalidator.revalidate();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [isPendingApproval, revalidator]);

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
        
        {/* ✅ Show loading banner when refreshing after billing approval */}
        {isRefreshing && (
          <div style={{ 
            padding: "12px 20px", 
            backgroundColor: "#D4EDDA",
            borderBottom: "1px solid #28A745",
            textAlign: "center"
          }}>
            <span style={{ fontWeight: 600 }}>
              🔄 Activating your plan... Please wait.
            </span>
          </div>
        )}
        
        {/* Show banner if billing is pending approval */}
        {isPendingApproval && !isRefreshing && (
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
        <div style={{ position: "relative", minHeight: "100vh" }}>
          {/* Render the actual page content - it will be visible but blurred */}
          <div style={{ 
            filter: isPageLocked ? "blur(4px)" : "none",
            pointerEvents: isPageLocked ? "none" : "auto",
            userSelect: isPageLocked ? "none" : "auto",
            opacity: isPageLocked ? "0.5" : "1",
            transition: "filter 0.3s ease, opacity 0.3s ease"
          }}>
            <Outlet />
          </div>
          
          {/* Overlay appears on top of the blurred content */}
          {isPageLocked && (
            <LockedPageOverlay 
              requiredPlan={requiredPlan} 
              currentPlan={usage?.plan || "FREE"}
              isPendingApproval={isPendingApproval}
              onNavigate={navigate}
            />
          )}
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