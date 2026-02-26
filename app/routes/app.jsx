// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.jsx
//
//  THE ACTUAL FIX:
//  onMessage() handler added in ROOT layout so foreground
//  FCM messages are caught on EVERY page, not just chat page.
//
//  When admin is on any page (settings, faq, subscription):
//  - Firebase sees app is "in foreground" → skips OS notif
//  - onMessage fires → we manually show OS notif + toast
//  - This works on Mac because Notification.requestPermission
//    was already granted at top level
// ═══════════════════════════════════════════════════════════
import { Outlet, useLoaderData, useRouteError, useLocation, useNavigate, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider, Badge } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import { authenticate } from "../shopify.server";
import { useEffect, useRef, useState } from "react";
import { getUsageStats } from "../planLimits.server";
import prisma from "../db.server";
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const FIREBASE_CONFIG = {
  apiKey           : "AIzaSyDOVZ95b_MZ7Ba5TVvpluX2Jz5h-7FXNNA",
  authDomain       : "talksy-b24e4.firebaseapp.com",
  projectId        : "talksy-b24e4",
  storageBucket    : "talksy-b24e4.firebasestorage.app",
  messagingSenderId: "19294207700",
  appId            : "1:19294207700:web:b4cd33123321f8eb784541",
  measurementId    : "G-Q7BYVQGTEP",
};
const FIREBASE_VAPID_KEY = "BByGfcXLNVQBVZdVUvPgsdK3lP6Avvw6FD_OcTauED_QyCUfqjyqvGDTxdgNhuh8YffyTdWuoQBFDnmiPfRHAU8";
const BACKEND_URL        = "https://talksy-production-5d43.up.railway.app";
const TALKSY_ICON        = "https://cdn.shopify.com/app-store/listing_images/177dd497355fe743fa747f74896d9015/icon/CJmW96zmq5IDEAE=.png";

// ── Loader ─────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const subscription = await prisma.subscription.findUnique({ where: { shop } });
  let usage = null;
  try {
    usage = await getUsageStats(shop);
  } catch {
    usage = {
      plan    : "FREE",
      chats   : { current: 0, max: 100, percentage: 0, remaining: 100 },
      faqs    : { current: 0, canManage: false },
      features: { canCustomizeWidget: false, canCreateCustomFAQPage: false },
      retention: { days: 30 },
    };
  }
  return {
    apiKey            : process.env.SHOPIFY_API_KEY || "",
    usage,
    subscriptionStatus: subscription?.status || "active",
    currentShop       : shop,
  };
};

// ── Locked overlay ─────────────────────────────────────────
function LockedPageOverlay({ requiredPlan, currentPlan, isPendingApproval, onNavigate }) {
  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, WebkitBackdropFilter:"blur(12px)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ borderRadius:"16px", padding:"48px 40px", maxWidth:"520px", textAlign:"center" }}>
        <div style={{ fontSize:"72px", marginBottom:"20px", lineHeight:1 }}>🔒</div>
        <h2 style={{ fontSize:"26px", fontWeight:"700", marginBottom:"12px", color:"#202223", lineHeight:"1.3" }}>
          {isPendingApproval ? "Billing Approval Required" : `Activate Your ${requiredPlan} Plan`}
        </h2>
        <p style={{ fontSize:"16px", color:"#6d7175", marginBottom:"28px", lineHeight:"1.6" }}>
          {isPendingApproval
            ? <>Your subscription upgrade is pending billing approval.</>
            : <>This feature requires the <strong>{requiredPlan}</strong> plan or higher.{currentPlan === "FREE" && " Upgrade now to unlock."}</>}
        </p>
        <button
          onClick={() => onNavigate("/app/subscription")}
          style={{ padding:"14px 32px", backgroundColor:"#005BD3", color:"white", borderRadius:"8px", fontWeight:"600", fontSize:"16px", border:"none", cursor:"pointer" }}
          onMouseEnter={e => { e.target.style.backgroundColor = "#004FC4"; }}
          onMouseLeave={e => { e.target.style.backgroundColor = "#005BD3"; }}
        >
          {isPendingApproval ? "Complete Billing Approval" : "View Plans"}
        </button>
      </div>
    </div>
  );
}

// ── Global in-app toast ────────────────────────────────────
function GlobalToast({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position:"fixed", bottom:"32px", right:"32px", zIndex:2147483647,
      display:"flex", flexDirection:"column-reverse", gap:"10px",
      maxWidth:"340px", pointerEvents:"none",
    }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{
          pointerEvents:"auto",
          background:"linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          color:"white", borderRadius:"16px", padding:"14px 16px",
          boxShadow:"0 6px 24px rgba(99,102,241,0.5)",
          display:"flex", alignItems:"flex-start", gap:"12px",
          animation:"talksySlideIn 0.3s ease",
          border:"1px solid rgba(255,255,255,0.15)",
          position:"relative", overflow:"hidden",
        }}>
          <div style={{ position:"absolute", bottom:0, left:0, height:"3px", background:"rgba(255,255,255,0.4)", animation:"talksyProgress 7s linear forwards", width:"100%" }} />
          <div style={{ width:"36px", height:"36px", background:"rgba(255,255,255,0.2)", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", flexShrink:0 }}>💬</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:"700", fontSize:"13px", marginBottom:"4px" }}>{toast.title}</div>
            {toast.imageUrl && (
              <img src={toast.imageUrl} alt="" style={{ width:"100%", maxHeight:"100px", objectFit:"cover", borderRadius:"8px", marginBottom:"6px" }} onError={e => e.currentTarget.style.display="none"} />
            )}
            <div style={{ fontSize:"12px", opacity:0.9, lineHeight:"1.45", wordBreak:"break-word" }}>{toast.body}</div>
            <div style={{ fontSize:"10px", opacity:0.6, marginTop:"4px" }}>{toast.time}</div>
          </div>
          <button onClick={() => onDismiss(toast.id)} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"white", width:"22px", height:"22px", borderRadius:"6px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"14px" }}>×</button>
        </div>
      ))}
      <style>{`
        @keyframes talksySlideIn  { from{transform:translateX(120%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes talksyProgress { from{width:100%} to{width:0%} }
      `}</style>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────
export default function App() {
  const { apiKey, usage, subscriptionStatus, currentShop } = useLoaderData();
  const location    = useLocation();
  const navigate    = useNavigate();
  const revalidator = useRevalidator();

  const [globalToasts, setGlobalToasts] = useState([]);
  const audioRef        = useRef(null);
  const tokenSavedRef   = useRef(false);
  const messagingRef    = useRef(null); // ← store messaging instance

  const pushGlobalToast = (title, body, imageUrl = null) => {
    const id = Date.now() + Math.random();
    setGlobalToasts(prev => [...prev, {
      id, title, body, imageUrl,
      time: new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }),
    }]);
    setTimeout(() => setGlobalToasts(prev => prev.filter(t => t.id !== id)), 8000);
  };

  // ── Show OS notification manually (for foreground messages) ──
  // When the app is open (foreground), FCM does NOT auto-show
  // the OS notification. We must call it ourselves via the
  // Notification API — this works fine because permission was
  // already granted by the user.
  function showOsNotification(title, body, imageUrl, shopUrl) {
    if (Notification.permission !== "granted") return;
    try {
      const notif = new Notification(title, {
        body,
        icon : TALKSY_ICON,
        badge: TALKSY_ICON,
        tag  : "talksy-foreground-" + Date.now(),
        ...(imageUrl ? { image: imageUrl } : {}),
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
        if (shopUrl) window.location.href = shopUrl;
      };
    } catch (err) {
      console.warn("[FCM] OS notification error:", err.message);
    }
  }

  // ════════════════════════════════════════════════════════
  //  FCM SETUP
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    if (!currentShop) return;

    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");

    // ── Step 1: SW message listener FIRST (no race condition) ──
    function onSwMessage(event) {
      if (!event.data || event.data.type !== "TALKSY_PUSH") return;
      console.log("[FCM] SW→page message:", event.data);
      if (audioRef.current) audioRef.current.play().catch(() => {});
      pushGlobalToast(
        event.data.title    || "💬 New Message",
        event.data.body     || "Customer sent a message",
        event.data.imageUrl || null,
      );
    }
    navigator.serviceWorker.addEventListener("message", onSwMessage);

    // ── Step 2: Register SW ────────────────────────────────
    async function registerSW() {
      try {
        const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        console.log("[FCM] SW registered");
        return swReg;
      } catch (err) {
        console.warn("[FCM] SW failed:", err.message);
        return null;
      }
    }

    // ── Step 3: Get token + setup onMessage ───────────────
    async function setupFCM(swReg) {
      if (Notification.permission !== "granted") return;
      try {
        const app       = getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
        const messaging = getMessaging(app);
        messagingRef.current = messaging;

        // Get + save token
        if (!tokenSavedRef.current) {
          const token = await getToken(messaging, {
            vapidKey                 : FIREBASE_VAPID_KEY,
            serviceWorkerRegistration: swReg,
          });
          if (token) {
            const res = await fetch(`${BACKEND_URL}/app/admin/register-fcm-token`, {
              method : "POST",
              headers: { "Content-Type": "application/json" },
              body   : JSON.stringify({ shop: currentShop, fcmToken: token, registeredAt: new Date().toISOString() }),
            });
            if (res.ok) {
              tokenSavedRef.current = true;
              console.log(`[FCM] ✅ Token saved for ${currentShop}`);
            }
          }
        }

        // ══════════════════════════════════════════════════
        //  KEY FIX: onMessage handler in ROOT layout
        //
        //  This fires when a push arrives AND the app window
        //  is currently focused (any page — settings, faq,
        //  subscription, etc.). Without this, FCM silently
        //  drops the notification when app is in foreground.
        //
        //  We:
        //  1. Show OS notification manually via Notification API
        //  2. Show in-app toast
        //  3. Play sound
        // ══════════════════════════════════════════════════
        const unsubscribe = onMessage(messaging, (payload) => {
          console.log("[FCM] Foreground message received on:", location.pathname, payload);

          const n         = payload.notification || {};
          const d         = payload.data         || {};
          const title     = n.title    || d.title    || "💬 New Message — Talksy";
          const body      = n.body     || d.body     || "A customer sent a message";
          const imageUrl  = d.imageUrl || d.fileUrl  || null;
          const shopUrl   = d.shopUrl  || "/";

          // 1. OS notification (Notification API — works on Mac)
          showOsNotification(title, body, imageUrl, shopUrl);

          // 2. In-app toast
          if (audioRef.current) audioRef.current.play().catch(() => {});
          pushGlobalToast(title, body, imageUrl);
        });

        // Return cleanup
        return unsubscribe;
      } catch (err) {
        console.warn("[FCM] setup error:", err.message);
        return null;
      }
    }

    // ── Step 4: Re-register when permission granted ────────
    let unsubscribeOnMessage = null;

    function onPermissionGranted() {
      tokenSavedRef.current = false;
      registerSW().then(async (swReg) => {
        if (swReg) {
          if (unsubscribeOnMessage) unsubscribeOnMessage();
          unsubscribeOnMessage = await setupFCM(swReg);
        }
      });
    }
    window.addEventListener("talksy:permission-granted", onPermissionGranted);

    // Run
    registerSW().then(async (swReg) => {
      if (swReg) unsubscribeOnMessage = await setupFCM(swReg);
    });

    return () => {
      navigator.serviceWorker.removeEventListener("message", onSwMessage);
      window.removeEventListener("talksy:permission-granted", onPermissionGranted);
      if (unsubscribeOnMessage) unsubscribeOnMessage();
    };
  }, [currentShop]);

  // ── Plan / billing ─────────────────────────────────────────
  const isApproachingLimit = usage && typeof usage.chats.percentage === "number" && usage.chats.percentage > 80;
  const isAtLimit          = usage && typeof usage.chats.percentage === "number" && usage.chats.percentage >= 100;
  const isBillingApproved  = subscriptionStatus === "active" || subscriptionStatus === "trialing";
  const isPendingApproval  = subscriptionStatus === "pending_approval";
  const isPremiumPlan      = usage && usage.plan === "PREMIUM"  && isBillingApproved;
  const isStandardPlan     = usage && usage.plan === "STANDARD" && isBillingApproved;
  const isPaidPlan         = isPremiumPlan || isStandardPlan;
  const canManageFAQs      = isPaidPlan;
  const canCustomizeWidget = isPaidPlan;

  const currentPath = location.pathname;
  let isPageLocked = false;
  let requiredPlan = "";
  if (currentPath.includes("/admin/search")) { isPageLocked = !isPaidPlan;         requiredPlan = "Standard"; }
  if (currentPath.includes("/settings"))     { isPageLocked = !canCustomizeWidget; requiredPlan = "Standard"; }
  if (currentPath.includes("/faq"))          { isPageLocked = !canManageFAQs;      requiredPlan = "Standard"; }

  const params           = new URLSearchParams(location.search);
  const showUnlockLoader = params.get("billing") === "complete" || params.get("success") === "true";

  useEffect(() => {
    if (params.get("success") === "true" || params.get("billing") === "complete") {
      setTimeout(() => { window.location.href = window.location.pathname; }, 1500);
    }
  }, [location.search]);

  useEffect(() => {
    if (isPendingApproval) {
      const interval = setInterval(() => revalidator.revalidate(), 5000);
      return () => clearInterval(interval);
    }
  }, [isPendingApproval, revalidator]);

  useEffect(() => {
    const beat = async () => { try { await fetch("/app/update-status", { method: "POST" }); } catch (_) {} };
    beat();
    const interval = setInterval(beat, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ShopifyAppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={enTranslations}>

        <GlobalToast toasts={globalToasts} onDismiss={(id) => setGlobalToasts(p => p.filter(t => t.id !== id))} />

        <s-app-nav key={`${usage?.plan}-${subscriptionStatus}-${isBillingApproved}`}>
          <s-link href="/app/chat/admin">Chats</s-link>
          <s-link href="/app/admin/search">Search {!isPaidPlan && "🔒"}</s-link>
          <s-link href="/app/settings">Settings {!canCustomizeWidget && "🔒"}</s-link>
          <s-link href="/app/faq">FAQs {!canManageFAQs && "🔒"}</s-link>
          <s-link href="/app/animation/question">Animated Questions</s-link>
          <s-link href="/app/subscription">
            Subscription
            {usage && isApproachingLimit && !isAtLimit && usage.chats.remaining !== "Unlimited" && (
              <span style={{ marginLeft:"8px" }}><Badge tone="warning">{usage.chats.remaining} left</Badge></span>
            )}
            {usage && isAtLimit && <span style={{ marginLeft:"8px" }}><Badge tone="critical">Limit Reached</Badge></span>}
            {isPendingApproval && <span style={{ marginLeft:"8px" }}><Badge tone="info">Pending</Badge></span>}
          </s-link>
        </s-app-nav>

        {showUnlockLoader && (
          <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:99999, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"20px" }}>
            <div style={{ width:"60px", height:"60px", border:"4px solid #E1E3E5", borderTop:"4px solid #005BD3", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
            <h2 style={{ fontSize:"24px", fontWeight:"600", color:"#202223", margin:0 }}>Activating Your Plan</h2>
            <p style={{ fontSize:"16px", color:"#6d7175", margin:0 }}>Unlocking features... Please wait</p>
            <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {isPendingApproval && !showUnlockLoader && (
          <div style={{ padding:"12px 20px", backgroundColor:"#E3F2FD", borderBottom:"1px solid #90CAF9", textAlign:"center" }}>
            <span style={{ fontWeight:600 }}>⏳ Subscription upgrade pending billing approval.</span>{" "}
            <button onClick={() => navigate("/app/subscription")} style={{ background:"none", border:"none", color:"#005BD3", textDecoration:"underline", cursor:"pointer", padding:0, font:"inherit" }}>Complete billing approval</button>
          </div>
        )}

        {usage && (isApproachingLimit || isAtLimit) && isBillingApproved && !showUnlockLoader && (
          <div style={{ padding:"12px 20px", backgroundColor:isAtLimit?"#FED3D1":"#FFF4E5", borderBottom:"1px solid #ddd", textAlign:"center" }}>
            <span style={{ fontWeight:600 }}>
              {isAtLimit
                ? `⚠️ You've reached your ${usage.plan} plan limit (${usage.chats.current}/${usage.chats.max} chats).`
                : `⚡ You're using ${Math.round(usage.chats.percentage)}% of your ${usage.plan} plan.`}
            </span>{" "}
            <button onClick={() => navigate("/app/subscription")} style={{ background:"none", border:"none", color:"#005BD3", textDecoration:"underline", cursor:"pointer", padding:0, font:"inherit" }}>
              {isAtLimit ? "Upgrade now to continue" : "Upgrade your plan"}
            </button>
          </div>
        )}

        <div style={{ position:"relative", minHeight:"100vh" }}>
          <div style={{ filter:isPageLocked?"blur(4px)":"none", pointerEvents:isPageLocked?"none":"auto", userSelect:isPageLocked?"none":"auto", opacity:isPageLocked?"0.5":"1", transition:"filter 0.3s ease, opacity 0.3s ease" }}>
            <Outlet />
          </div>
          {isPageLocked && (
            <LockedPageOverlay
              requiredPlan     ={requiredPlan}
              currentPlan      ={usage?.plan || "FREE"}
              isPendingApproval={isPendingApproval}
              onNavigate       ={navigate}
            />
          )}
        </div>

      </PolarisAppProvider>
    </ShopifyAppProvider>
  );
}

export function ErrorBoundary() { return boundary.error(useRouteError()); }
export const headers = (headersArgs) => boundary.headers(headersArgs);