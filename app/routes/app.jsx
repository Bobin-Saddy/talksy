// app/routes/app.jsx - WITH BLUR OVERLAY FOR LOCKED FEATURES + FCM REGISTRAR
import { Outlet, useLoaderData, useRouteError, useLocation, useNavigate, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider, Badge } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import { authenticate } from "../shopify.server";
import { useEffect, useRef } from "react";
import { getUsageStats } from "../planLimits.server";
import prisma from "../db.server";

// 🔥 FCM imports
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

// ── Firebase config ────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey           : "AIzaSyAkp3v6YWY4HexFQ7Z0BYPGMeG18IXXqWg",
  authDomain       : "shopify-talksy.firebaseapp.com",
  projectId        : "shopify-talksy",
  storageBucket    : "shopify-talksy.firebasestorage.app",
  messagingSenderId: "547076667229",
  appId            : "1:547076667229:web:e65ed249fe33f7724e9ab4",
};
const FIREBASE_VAPID_KEY =
  "BJzrkyA1gwJTL7auMx6y0RHjv34mSPzm6FpY5twRsMuuE54l0nL4cl4UUltGcgqO5cNGcJjWEugjyZFkkfTI1AE";
const BACKEND_URL = "https://talksy-production-5d43.up.railway.app";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  const subscription = await prisma.subscription.findUnique({
    where: { shop },
  });
  
  let usage = null;
  try {
    usage = await getUsageStats(shop);
  } catch (error) {
    console.error("Error getting usage stats:", error);
    usage = {
      plan: "FREE",
      chats: { current: 0, max: 100, percentage: 0, remaining: 100 },
      faqs: { current: 0, canManage: false },
      features: { canCustomizeWidget: false, canCreateCustomFAQPage: false },
      retention: { days: 30 },
    };
  }
  
  return { 
    apiKey            : process.env.SHOPIFY_API_KEY || "",
    usage,
    subscriptionStatus: subscription?.status || "active",
    currentShop       : shop, // ✅ expose shop for FCM registration
  };
};

// ── Locked page overlay ────────────────────────────────────
function LockedPageOverlay({ requiredPlan, currentPlan, isPendingApproval, onNavigate }) {
  return (
    <div style={{
      position        : "fixed",
      top             : 0, left: 0, right: 0, bottom: 0,
      WebkitBackdropFilter: "blur(12px)",
      zIndex          : 9999,
      display         : "flex",
      alignItems      : "center",
      justifyContent  : "center",
      padding         : "20px",
    }}>
      <div style={{
        borderRadius: "16px",
        padding     : "48px 40px",
        maxWidth    : "520px",
        textAlign   : "center",
      }}>
        <div style={{ fontSize: "72px", marginBottom: "20px", lineHeight: 1 }}>🔒</div>
        <h2 style={{ fontSize: "26px", fontWeight: "700", marginBottom: "12px", color: "#202223", lineHeight: "1.3" }}>
          {isPendingApproval ? "Billing Approval Required" : `Activate Your ${requiredPlan} Plan`}
        </h2>
        <p style={{ fontSize: "16px", color: "#6d7175", marginBottom: "28px", lineHeight: "1.6" }}>
          {isPendingApproval ? (
            <>Your subscription upgrade is pending billing approval. Complete the billing process to access this feature.</>
          ) : (
            <>This feature is available on the <strong>{requiredPlan}</strong> plan or higher.{currentPlan === "FREE" && " Upgrade now to unlock this feature."}</>
          )}
        </p>
        <button
          onClick={() => onNavigate("/app/subscription")}
          style={{
            display        : "inline-block",
            padding        : "14px 32px",
            backgroundColor: "#005BD3",
            color          : "white",
            textDecoration : "none",
            borderRadius   : "8px",
            fontWeight     : "600",
            fontSize       : "16px",
            transition     : "all 0.2s ease",
            boxShadow      : "0 2px 8px rgba(0, 91, 211, 0.3)",
            border         : "none",
            cursor         : "pointer",
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = "#004FC4";
            e.target.style.transform       = "translateY(-1px)";
            e.target.style.boxShadow       = "0 4px 12px rgba(0, 91, 211, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = "#005BD3";
            e.target.style.transform       = "translateY(0)";
            e.target.style.boxShadow       = "0 2px 8px rgba(0, 91, 211, 0.3)";
          }}
        >
          {isPendingApproval ? "Complete Billing Approval" : "View Plans"}
        </button>
      </div>
    </div>
  );
}

// ── Silent FCM registrar hook ──────────────────────────────
// Runs on every app page load. If notification permission is already
// granted, it silently re-registers the FCM token so push notifications
// work even when the admin is NOT on the chat panel.
function useFcmRegistrar(shop) {
  const registeredRef = useRef(false);

  useEffect(() => {
    if (registeredRef.current) return;
    if (!shop) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

    // Only register silently if permission is already granted.
    // First-time permission prompt is handled by the "Enable Notifications"
    // button inside app.chat.admin.jsx — we never auto-prompt here.
    if (Notification.permission !== "granted") {
      console.log(`[FCM] Permission is "${Notification.permission}" — skipping silent registration`);
      return;
    }

    registeredRef.current = true;

    async function register() {
      try {
        // Register (or reuse) the Firebase service worker
        const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        await navigator.serviceWorker.ready;

        // Init Firebase (reuse existing app if already initialized)
        const app = getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
        const messaging = getMessaging(app);

        // Get FCM token
        const token = await getToken(messaging, {
          vapidKey                 : FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });

        if (!token) {
          console.warn("[FCM] Could not obtain token");
          return;
        }

        // Save token to backend DB
        const res = await fetch(`${BACKEND_URL}/app/admin/register-fcm-token`, {
          method : "POST",
          headers: { "Content-Type": "application/json" },
          body   : JSON.stringify({
            shop,
            fcmToken    : token,
            registeredAt: new Date().toISOString(),
          }),
        });

        if (res.ok) {
          console.log(`[FCM] ✅ Token registered for ${shop}: ...${token.slice(-8)}`);
        } else {
          console.warn("[FCM] Token save failed:", res.status);
        }
      } catch (err) {
        // Never block the UI — this is a background task
        console.warn("[FCM] Silent registration error (non-blocking):", err.message);
      }
    }

    // Small delay so main page renders first
    const timer = setTimeout(register, 1500);
    return () => clearTimeout(timer);
  }, [shop]);
}

export default function App() {
  const { apiKey, usage, subscriptionStatus, currentShop } = useLoaderData();
  const location    = useLocation();
  const navigate    = useNavigate();
  const revalidator = useRevalidator();

  // ✅ Register FCM token silently on every app page load
  useFcmRegistrar(currentShop);

  const isApproachingLimit = usage && typeof usage.chats.percentage === "number" && usage.chats.percentage > 80;
  const isAtLimit          = usage && typeof usage.chats.percentage === "number" && usage.chats.percentage >= 100;

  const isBillingApproved = subscriptionStatus === "active" || subscriptionStatus === "trialing";
  const isPendingApproval = subscriptionStatus === "pending_approval";

  const isPremiumPlan  = usage && usage.plan === "PREMIUM"  && isBillingApproved;
  const isStandardPlan = usage && usage.plan === "STANDARD" && isBillingApproved;
  const isPaidPlan     = isPremiumPlan || isStandardPlan;

  const canManageFAQs      = isPremiumPlan || isStandardPlan;
  const canCustomizeWidget = isPremiumPlan || isStandardPlan;

  console.log("🔍 Current App State:", {
    plan              : usage?.plan,
    status            : subscriptionStatus,
    isBillingApproved,
    isPremiumPlan,
    isStandardPlan,
    isPaidPlan,
    canManageFAQs,
    canCustomizeWidget,
  });

  const currentPath = location.pathname;
  let isPageLocked = false;
  let requiredPlan = "";

  if (currentPath.includes("/admin/search")) {
    isPageLocked = !isPaidPlan;
    requiredPlan = "Standard";
  }
  if (currentPath.includes("/settings")) {
    isPageLocked = !canCustomizeWidget;
    requiredPlan = "Standard";
  }
  if (currentPath.includes("/faq")) {
    isPageLocked = !canManageFAQs;
    requiredPlan = "Standard";
  }

  const params              = new URLSearchParams(location.search);
  const isBillingComplete   = params.get("billing") === "complete";
  const isSuccess           = params.get("success") === "true";
  const showUnlockLoader    = isBillingComplete || isSuccess;

  useEffect(() => {
    const hasSuccess         = params.get("success") === "true";
    const hasBillingComplete = params.get("billing") === "complete";

    if (hasSuccess || hasBillingComplete) {
      console.log("✅ BILLING APPROVED DETECTED! Reloading in 1.5s...");
      setTimeout(() => {
        window.location.href = window.location.pathname;
      }, 1500);
    }
  }, [location.search, revalidator, usage, subscriptionStatus, isPremiumPlan, isStandardPlan, isPaidPlan, canManageFAQs, canCustomizeWidget]);

  useEffect(() => {
    if (isPendingApproval) {
      const interval = setInterval(() => {
        console.log("🔄 Checking for billing approval...");
        revalidator.revalidate();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isPendingApproval, revalidator]);

  // Heartbeat
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
        <s-app-nav key={`${usage?.plan}-${subscriptionStatus}-${isBillingApproved}`}>
          <s-link href="/app/chat/admin">Chats</s-link>
          <s-link href="/app/admin/search">Search {!isPaidPlan && "🔒"}</s-link>
          <s-link href="/app/settings">Settings {!canCustomizeWidget && "🔒"}</s-link>
          <s-link href="/app/faq">FAQs {!canManageFAQs && "🔒"}</s-link>
          <s-link href="/app/subscription">
            Subscription
            {usage && isApproachingLimit && !isAtLimit && usage.chats.remaining !== "Unlimited" && (
              <span style={{ marginLeft: "8px" }}>
                <Badge tone="warning">{usage.chats.remaining} left</Badge>
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

        {/* Full-screen loader after billing approval */}
        {showUnlockLoader && (
          <div style={{
            position      : "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex        : 99999,
            display       : "flex",
            flexDirection : "column",
            alignItems    : "center",
            justifyContent: "center",
            gap           : "20px",
          }}>
            <div style={{
              width       : "60px",
              height      : "60px",
              border      : "4px solid #E1E3E5",
              borderTop   : "4px solid #005BD3",
              borderRadius: "50%",
              animation   : "spin 1s linear infinite",
            }} />
            <h2 style={{ fontSize: "24px", fontWeight: "600", color: "#202223", margin: 0 }}>
              Activating Your Plan
            </h2>
            <p style={{ fontSize: "16px", color: "#6d7175", margin: 0 }}>
              Unlocking features... Please wait
            </p>
            <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
          </div>
        )}

        {/* Pending approval banner */}
        {isPendingApproval && !showUnlockLoader && (
          <div style={{ padding: "12px 20px", backgroundColor: "#E3F2FD", borderBottom: "1px solid #90CAF9", textAlign: "center" }}>
            <span style={{ fontWeight: 600 }}>⏳ Your subscription upgrade is pending billing approval.</span>
            {" "}
            <button onClick={() => navigate("/app/subscription")} style={{ background: "none", border: "none", color: "#005BD3", textDecoration: "underline", cursor: "pointer", padding: 0, font: "inherit" }}>
              Complete billing approval
            </button>
          </div>
        )}

        {/* Approaching / at limit banner */}
        {usage && (isApproachingLimit || isAtLimit) && isBillingApproved && !showUnlockLoader && (
          <div style={{ padding: "12px 20px", backgroundColor: isAtLimit ? "#FED3D1" : "#FFF4E5", borderBottom: "1px solid #ddd", textAlign: "center" }}>
            <span style={{ fontWeight: 600 }}>
              {isAtLimit
                ? `⚠️ You've reached your ${usage.plan} plan limit (${usage.chats.current}/${usage.chats.max} chats).`
                : `⚡ You're using ${Math.round(usage.chats.percentage)}% of your ${usage.plan} plan.`}
            </span>
            {" "}
            <button onClick={() => navigate("/app/subscription")} style={{ background: "none", border: "none", color: "#005BD3", textDecoration: "underline", cursor: "pointer", padding: 0, font: "inherit" }}>
              {isAtLimit ? "Upgrade now to continue" : "Upgrade your plan"}
            </button>
          </div>
        )}

        {/* Main content — blurred if page is locked */}
        <div style={{ position: "relative", minHeight: "100vh" }}>
          <div style={{
            filter      : isPageLocked ? "blur(4px)" : "none",
            pointerEvents: isPageLocked ? "none" : "auto",
            userSelect  : isPageLocked ? "none" : "auto",
            opacity     : isPageLocked ? "0.5" : "1",
            transition  : "filter 0.3s ease, opacity 0.3s ease",
          }}>
            <Outlet />
          </div>

          {isPageLocked && (
            <LockedPageOverlay
              requiredPlan      ={requiredPlan}
              currentPlan       ={usage?.plan || "FREE"}
              isPendingApproval ={isPendingApproval}
              onNavigate        ={navigate}
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