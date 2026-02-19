// ═══════════════════════════════════════════════════════════
//  FILE: app/routes/app.chat.admin.jsx
//  CHANGES: Firebase FCM push notifications added + fixed
//  FIXES:
//    1. Removed duplicate Notification.requestPermission() call
//    2. Added fcmInitRef guard to prevent multiple FCM setups
//    3. Added notifBlocked state + UI banner for denied permission
//    4. Fixed SW scope conflict between /sw.js and firebase-messaging-sw.js
//    5. ✅ NEW: "Enable Notifications" button for default/not-yet-granted state
//  SEARCH: "🔥 FCM" to find all FCM additions
// ═══════════════════════════════════════════════════════════

import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { canCreateChat, shouldBlurChat } from "../planLimits.server";

// 🔥 FCM — Firebase imports
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const BACKEND_URL = "https://talksy-production-5d43.up.railway.app";

// 🔥 FCM — Firebase config
const FIREBASE_CONFIG = {
  apiKey           : "AIzaSyAkp3v6YWY4HexFQ7Z0BYPGMeG18IXXqWg",
  authDomain       : "shopify-talksy.firebaseapp.com",
  projectId        : "shopify-talksy",
  storageBucket    : "shopify-talksy.firebasestorage.app",
  messagingSenderId: "547076667229",
  appId            : "1:547076667229:web:e65ed249fe33f7724e9ab4",
};
const FIREBASE_VAPID_KEY = "BJzrkyA1gwJTL7auMx6y0RHjv34mSPzm6FpY5twRsMuuE54l0nL4cl4UUltGcgqO5cNGcJjWEugjyZFkkfTI1AE";

// ─── Existing push helpers (VAPID) ────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function subscribeToPush(shop) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('❌ Yeh browser push notifications support nahi karta.\nChrome ya Edge use karo.');
    return null;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    alert('❌ Notification permission deny ki gayi.\nBrowser settings mein jaake allow karo.');
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    const keyRes = await fetch(`${BACKEND_URL}/app/vapid-public-key`);
    if (!keyRes.ok) throw new Error('VAPID key fetch failed');
    const { publicKey } = await keyRes.json();
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }
    const saveRes = await fetch(`${BACKEND_URL}/app/admin/push-subscribe`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ shop, subscription })
    });
    if (!saveRes.ok) {
      const err = await saveRes.json();
      throw new Error(err.error || 'Subscription save failed');
    }
    return subscription;
  } catch (err) {
    console.error('[Push] Subscribe error:', err);
    alert('❌ Notification setup fail hua:\n' + err.message);
    return null;
  }
}

async function unsubscribeFromPush(shop) {
  try {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) return true;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await fetch(`${BACKEND_URL}/app/admin/push-unsubscribe`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ shop, endpoint: subscription.endpoint })
      });
      await subscription.unsubscribe();
    }
    return true;
  } catch (err) {
    console.error('[Push] Unsubscribe error:', err);
    return false;
  }
}

async function checkPushStatus() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch (_) {
    return false;
  }
}

// --- ICONS SET ---
const Icons = {
  Send: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  Search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  User: ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  Clock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  Paperclip: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>,
  Smile: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>,
  X: ({ size = 20, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  FileText: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>,
  CheckCircle: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  AlertCircle: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>,
  RotateCcw: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  TrendingUp: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>,
  AlertTriangle: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
  Inbox: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>,
  Lock: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
  Eye: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
  EyeOff: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>,
  Zap: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>,
  Bell: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>,
  BellOff: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><path d="M18.63 13A17.89 17.89 0 0 1 18 8"></path><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path><path d="M18 8a6 6 0 0 0-9.33-5"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>,
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  if (!shop) throw new Response("Unauthorized", { status: 401 });

  const sessions = await prisma.chatSession.findMany({
    where: { shop },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "asc" }
  });

  const chatLimit = await canCreateChat(shop);

  const sessionsWithLimitInfo = await Promise.all(
    sessions.map(async (session, index) => {
      const isOverLimit = chatLimit.max > 0 && index >= chatLimit.max;
      const blurInfo = await shouldBlurChat(shop, session.createdAt);
      return {
        ...session,
        chatIndex    : index + 1,
        isOverLimit,
        shouldBlur   : blurInfo.shouldBlur,
        blurReason   : blurInfo.reason,
        retentionDays: blurInfo.retentionDays,
        currentPlan  : blurInfo.plan,
      };
    })
  );

  sessionsWithLimitInfo.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  return json({
    sessions   : sessionsWithLimitInfo,
    currentShop: shop,
    planLimit  : {
      current     : sessions.length,
      max         : chatLimit.max,
      remaining   : chatLimit.remaining,
      isNearLimit : chatLimit.remaining <= 5 && chatLimit.remaining > 0,
      isAtLimit   : !chatLimit.allowed,
      isOverLimit : chatLimit.max > 0 && sessions.length > chatLimit.max,
      overLimitBy : chatLimit.max > 0 ? Math.max(0, sessions.length - chatLimit.max) : 0,
    }
  });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const body = await request.json();

  if (body.action === "resolve") {
    await prisma.chatSession.update({
      where: { sessionId: body.sessionId },
      data : { isResolved: true, resolvedAt: new Date(), resolvedBy: "admin" }
    });
    return json({ success: true });
  }
  if (body.action === "unresolve") {
    await prisma.chatSession.update({
      where: { sessionId: body.sessionId },
      data : { isResolved: false, resolvedAt: null, resolvedBy: null }
    });
    return json({ success: true });
  }
  return json({ success: false });
};

export default function NeuralChatAdmin() {
  const { sessions: initialSessions, currentShop, planLimit: initialPlanLimit } = useLoaderData();
  const navigate = useNavigate();
  const [sessions, setSessions]           = useState(initialSessions);
  const [planLimit, setPlanLimit]         = useState(initialPlanLimit);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages]           = useState([]);
  const [reply, setReply]                 = useState("");
  const [accentColor]                     = useState("#6366f1");
  const [searchTerm, setSearchTerm]       = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [filePreview, setFilePreview]     = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [unreadCounts, setUnreadCounts]   = useState({});
  const [filterStatus, setFilterStatus]   = useState("all");
  const [showBlurPopup, setShowBlurPopup] = useState(false);
  const [pushEnabled, setPushEnabled]     = useState(false);
  const [pushLoading, setPushLoading]     = useState(false);

  // 🔥 FCM — state
  const [fcmReady, setFcmReady]             = useState(false);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false); // ✅ step-by-step permission modal
  const [adminToasts, setAdminToasts]       = useState([]); // ✅ array — supports multiple simultaneous toasts
  const [notifBlocked, setNotifBlocked]     = useState(false);   // always false on SSR
  const [notifPermission, setNotifPermission] = useState("default"); // always "default" on SSR — real value set in useEffect

  const fetcher            = useFetcher();
  const scrollRef          = useRef(null);
  const fileInputRef       = useRef(null);
  const audioRef           = useRef(null);
  const lastMessageIdRef   = useRef(null);
  const isFirstLoadRef     = useRef(true);
  const lastSessionCountRef = useRef(initialSessions.length);
  const fcmInitRef         = useRef(false);

  const emojis = ["😊","👍","❤️","🙌","✨","🔥","✅","🤔","💡","🚀","👋","🙏","🎉"];
  const goToSubscription = () => navigate("/app/subscription");

  // ✅ Shared helper — pushes each message into the toasts array (supports rapid-fire messages)
  // ✅ Helper: push a toast from any source (FCM or polling)
  const pushToast = (title, body, sessionId, imageUrl = null) => {
    const toastId = Date.now() + Math.random();
    const newToast = {
      id       : toastId,
      title,
      body,
      sessionId,
      imageUrl,                            // ✅ image support
      isImage  : !!(imageUrl),
      time     : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };
    setAdminToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setAdminToasts(prev => prev.filter(t => t.id !== toastId));
    }, 8000);
    return toastId;
  };

  const attachFcmMessageHandler = (messagingInstance) => {
    onMessage(messagingInstance, (payload) => {
      console.log("🔔 FCM foreground message:", payload);
      if (audioRef.current) audioRef.current.play().catch(() => {});

      // Extract image URL — check both notification.image and data fields
      const imageUrl = payload.notification?.image
        || payload.data?.imageUrl
        || payload.data?.fileUrl
        || null;

      const isImageMsg = !!(imageUrl);
      const bodyText = isImageMsg
        ? "📷 Sent an image"
        : (payload.notification?.body || payload.data?.message || "Customer sent a message");

      if (document.hidden) {
        // Tab hidden → native browser notification
        new Notification(payload.notification?.title || "💬 New Message", {
          body : bodyText,
          icon : imageUrl || "/favicon.ico",
          image: imageUrl || undefined,
        });
      } else {
        // Tab visible → push into toast stack
        pushToast(
          payload.notification?.title || "💬 New Message",
          bodyText,
          payload.data?.sessionId,
          imageUrl,
        );
      }
    });
  };

  // ✅ NEW: Shared FCM init function (reusable by both useEffect and Enable button)
  const initFCM = async () => {
    try {
      const app = getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
      const messaging = getMessaging(app);

      let swReg;
      try {
        swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        console.log("✅ FCM SW registered");
      } catch (e) {
        console.warn("FCM SW registration failed:", e.message);
        return false;
      }

      const token = await getToken(messaging, {
        vapidKey                  : FIREBASE_VAPID_KEY,
        serviceWorkerRegistration : swReg,
      });

      if (!token) {
        console.warn("⚠️ FCM token nahi mila");
        return false;
      }

      console.log("✅ Admin FCM token:", token.substring(0, 20) + "...");

      await fetch(`${BACKEND_URL}/app/admin/register-fcm-token`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({
          shop        : currentShop,
          fcmToken    : token,
          registeredAt: new Date().toISOString(),
        }),
      });

      console.log("✅ Admin FCM token backend mein save ho gaya");
      setFcmReady(true);
      setNotifBlocked(false);
      setNotifPermission("granted");
      attachFcmMessageHandler(messaging);
      return true;
    } catch (err) {
      console.error("❌ FCM init failed:", err.message);
      return false;
    }
  };

  // ─── Push toggle (existing VAPID logic) ───────────────────
  const handlePushToggle = async () => {
    setPushLoading(true);
    try {
      if (pushEnabled) {
        const ok = await unsubscribeFromPush(currentShop);
        if (ok) { setPushEnabled(false); alert('🔕 Push notifications band kar di gayi.'); }
      } else {
        const sub = await subscribeToPush(currentShop);
        if (sub) {
          setPushEnabled(true);
          alert('✅ Push notifications chalu ho gayi!\n\nAb jab bhi koi customer message karega, tumhare browser mein notification aayega.');
        }
      }
    } finally {
      setPushLoading(false);
    }
  };

  // ✅ NEW: Handle "Enable Notifications" button click
  const handleEnableNotifications = async () => {
    if (!("Notification" in window)) {
      alert("❌ Yeh browser notifications support nahi karta.");
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") {
      setNotifBlocked(false);
      fcmInitRef.current = false; // reset guard so initFCM can run
      await initFCM();
    } else if (perm === "denied") {
      setNotifBlocked(true);
    }
  };

  // ─── Init audio + check push status ───────────────────────
  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");
    checkPushStatus().then(setPushEnabled);

    // ✅ FIX: Load Google Fonts client-side only (avoids SSR 404 and hydration mismatch #418)
    if (!document.getElementById("inter-font")) {
      const link = document.createElement("link");
      link.id   = "inter-font";
      link.rel  = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }

    // ✅ FIX: Read real browser permission on load — never set notifBlocked when granted
    if ("Notification" in window) {
      const perm = Notification.permission;
      setNotifPermission(perm);
      // Only show blocked banner when truly denied — clear it if granted
      if (perm === "granted") {
        setNotifBlocked(false);
      } else if (perm === "denied") {
        setNotifBlocked(true);
      }
      // "default" = not yet asked — shows "Enable Now" button instead
    }
  }, []);

  // 🔥 FCM — Setup Firebase push for admin
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    if (fcmInitRef.current) return;
    fcmInitRef.current = true;

    async function setupFCM() {
      try {
        const app = getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
        const messaging = getMessaging(app);

        let swReg;
        try {
          swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
          console.log("✅ FCM SW registered");
        } catch (e) {
          console.warn("FCM SW registration failed:", e.message);
          return;
        }

        // Check existing permission — only prompt if "default"
        let perm = Notification.permission;
        if (perm === "default") {
          // ✅ Do NOT auto-prompt here — let the user click "Enable Now" button instead
          console.log("🔔 Notification permission not yet granted — showing Enable button");
          setNotifPermission("default");
          return;
        }
        if (perm !== "granted") {
          console.log("🔕 Notification permission denied");
          if (perm === "denied") setNotifBlocked(true);
          return;
        }

        const token = await getToken(messaging, {
          vapidKey                  : FIREBASE_VAPID_KEY,
          serviceWorkerRegistration : swReg,
        });

        if (!token) {
          console.warn("⚠️ FCM token nahi mila");
          return;
        }

        console.log("✅ Admin FCM token:", token.substring(0, 20) + "...");

        await fetch(`${BACKEND_URL}/app/admin/register-fcm-token`, {
          method : "POST",
          headers: { "Content-Type": "application/json" },
          body   : JSON.stringify({
            shop        : currentShop,
            fcmToken    : token,
            registeredAt: new Date().toISOString(),
          }),
        });

        console.log("✅ Admin FCM token backend mein save ho gaya");
        setFcmReady(true);
        setNotifPermission("granted");
        attachFcmMessageHandler(messaging);

      } catch (err) {
        console.error("❌ FCM setup failed:", err.message);
        // ✅ FIX: SW registration failure or getToken failure is NOT a permission denial.
        // Do NOT set notifBlocked here — only set it when Notification.permission === "denied"
        // Re-read the real permission so UI reflects truth
        if ("Notification" in window) {
          const realPerm = Notification.permission;
          setNotifPermission(realPerm);
          setNotifBlocked(realPerm === "denied");
          if (realPerm === "granted") setNotifBlocked(false);
        }
      }
    }

    setupFCM();
  }, [currentShop]);

  // ─── Session polling ───────────────────────────────────────
  useEffect(() => {
    let pollFailCount = 0;
    const MAX_FAILS = 5;

    const interval = setInterval(async () => {
      // ✅ FIX: Skip poll if too many consecutive failures (avoids log spam)
      if (pollFailCount >= MAX_FAILS) return;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

      try {
        const res = await fetch("/app/chat/poll", {
          headers    : { Accept: "application/json" },
          credentials: "include",
          signal     : controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          pollFailCount++;
          return;
        }
        const ct = res.headers.get("content-type");
        if (!ct || !ct.includes("application/json")) { pollFailCount++; return; }

        const data = await res.json();
        if (!data.sessions || !data.planLimit) return;

        pollFailCount = 0; // reset on success

        const currentSessionIds = sessions.map(s => s.sessionId);
        const newSessions = data.sessions.filter(s => !currentSessionIds.includes(s.sessionId));

        setSessions([...data.sessions]);
        setPlanLimit({ ...data.planLimit });

        if (activeSession) {
          const updatedActive = data.sessions.find(s => s.sessionId === activeSession.sessionId);
          if (updatedActive?.shouldBlur && !activeSession.shouldBlur) {
            setActiveSession(null); setMessages([]); setShowBlurPopup(false);
          } else if (updatedActive && new Date(updatedActive.updatedAt) > new Date(activeSession.updatedAt)) {
            setActiveSession({ ...updatedActive });
          }
        }

        if (newSessions.length > 0) {
          if (audioRef.current) audioRef.current.play().catch(() => {});
          if (Notification.permission === "granted") {
            newSessions.forEach(s => new Notification("New Chat Request", {
              body: "From: " + (s.email || "Customer"),
              icon: "/favicon.ico",
            }));
          }
          if (newSessions.some(s => s.isOverLimit)) setFilterStatus("requests");
        }

        lastSessionCountRef.current = data.sessions.length;
      } catch (e) {
        clearTimeout(timeout);
        if (e.name === "AbortError") return; // timeout — silent
        pollFailCount++;
        if (pollFailCount <= 2) console.warn("Session poll error:", e.message);
      }
    }, 3000); // ✅ FIX: Slowed from 1500ms to 3000ms to reduce rate-limit issues
    return () => clearInterval(interval);
  }, [sessions, activeSession]);

  const filteredSessions = useMemo(() => {
    let filtered = sessions.filter(s => s.email?.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterStatus === "requests") {
      filtered = filtered.filter(s => s.isOverLimit === true);
    } else {
      filtered = filtered.filter(s => s.isOverLimit !== true);
      if (filterStatus === "pending")  filtered = filtered.filter(s => !s.isResolved);
      if (filterStatus === "resolved") filtered = filtered.filter(s =>  s.isResolved);
    }
    return filtered;
  }, [sessions, searchTerm, filterStatus]);

  const isActiveSessionOverLimit = activeSession?.isOverLimit === true;
  const isActiveSessionBlurred   = activeSession?.shouldBlur  === true;
  const withinLimitSessions      = sessions.filter(s => s.isOverLimit !== true);
  const overLimitSessions        = sessions.filter(s => s.isOverLimit === true);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const notifyNewMessage = (session, message) => {
    if (audioRef.current) audioRef.current.play().catch(() => {});
    if (activeSession?.sessionId !== session.sessionId)
      setUnreadCounts(prev => ({ ...prev, [session.sessionId]: (prev[session.sessionId] || 0) + 1 }));

    const isImage   = !!(message.fileUrl && (message.fileUrl.includes("image") || message.fileUrl.startsWith("data:image")));
    const isFile    = !!(message.fileUrl && !isImage);
    const bodyText  = isImage ? "📷 Sent an image" : isFile ? "📎 Sent a file" : (message.message || "New message");
    const imageUrl  = isImage ? message.fileUrl : null;
    const senderName = session.email?.split("@")[0] || "Customer";

    if (document.visibilityState !== "visible" && Notification.permission === "granted") {
      new Notification("💬 " + senderName, {
        body : bodyText,
        icon : imageUrl || "/favicon.ico",
        image: imageUrl || undefined,
      });
    } else {
      // Show in-app toast for every new message (even when tab is visible)
      pushToast("💬 " + senderName, bodyText, session.sessionId, imageUrl);
    }
  };

  useEffect(() => {
    if (!activeSession) return;
    let msgFailCount = 0;
    const MAX_MSG_FAILS = 5;

    const interval = setInterval(async () => {
      if (msgFailCount >= MAX_MSG_FAILS) return;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const res = await fetch("/app/chat/messages?sessionId=" + activeSession.sessionId, {
          headers: { Accept: "application/json" },
          credentials: "include",
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) { msgFailCount++; return; }
        const ct = res.headers.get("content-type");
        if (!ct || !ct.includes("application/json")) { msgFailCount++; return; }

        const data = await res.json();
        if (!Array.isArray(data)) return;

        msgFailCount = 0; // reset on success

        const hasNew     = data.length !== messages.length;
        const hasUpdated = data.length > 0 && messages.length > 0 && data[data.length - 1].id !== lastMessageIdRef.current;
        if (hasNew || hasUpdated) {
          // ✅ FIX: find ALL new messages since last known ID — not just the latest one
          const lastKnownId = lastMessageIdRef.current;
          const newMessages = lastKnownId
            ? data.filter(m => m.sender === "user" && m.id > lastKnownId)
            : (hasNew ? data.filter(m => m.sender === "user").slice(-1) : []);

          if (!isFirstLoadRef.current && newMessages.length > 0) {
            newMessages.forEach(msg => notifyNewMessage(activeSession, msg));
          }
          setMessages([...data]);
          if (data.length > 0) lastMessageIdRef.current = data[data.length - 1].id;
        }
      } catch (err) {
        clearTimeout(timeout);
        if (err.name === "AbortError") return;
        msgFailCount++;
        if (msgFailCount <= 2) console.warn("Message poll error:", err.message);
      }
    }, 1200); // ✅ FIX: 1.2s for near-instant message detection
    return () => clearInterval(interval);
  }, [activeSession?.sessionId, messages.length]);

  const loadChat = async (session) => {
    if (session.shouldBlur) { setShowBlurPopup(true); return; }
    setActiveSession(session);
    setUnreadCounts(prev => ({ ...prev, [session.sessionId]: 0 }));
    isFirstLoadRef.current = true;
    try {
      const res  = await fetch("/app/chat/messages?sessionId=" + session.sessionId);
      const data = await res.json();
      if (data.length > 0) lastMessageIdRef.current = data[data.length - 1].id;
      setMessages(data);
      setTimeout(() => { isFirstLoadRef.current = false; }, 500);
    } catch (_) {}
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setFilePreview({ url: reader.result, name: file.name, type: file.type });
    reader.readAsDataURL(file);
  };

  const addEmoji = (emoji) => { setReply(prev => prev + emoji); setShowEmojiPicker(false); };

  const handleReply = async (text = null) => {
    if (isActiveSessionOverLimit) { alert("This chat is over your plan limit. Upgrade to respond."); return; }
    if (isActiveSessionBlurred)   { setShowBlurPopup(true); return; }
    const finalMsg  = text || reply;
    const finalFile = filePreview?.url;
    if ((!finalMsg.trim() && !finalFile) || !activeSession) return;
    const newMessage = {
      message  : finalMsg || "Attachment",
      sender   : "admin",
      createdAt: new Date().toISOString(),
      sessionId: activeSession.sessionId,
      shop     : currentShop,
      fileUrl  : finalFile || null,
    };
    setReply(""); setFilePreview(null); setShowEmojiPicker(false);
    try {
      const response = await fetch("/app/chat/message", {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify(newMessage),
      });
      const result = await response.json();
      if (!result.success) alert("Failed to send message. Please try again.");
    } catch (_) { alert("Failed to send message. Please try again."); }
  };

  const handleMarkResolved = async () => {
    if (!activeSession) return;
    fetcher.submit(JSON.stringify({ action: "resolve", sessionId: activeSession.sessionId }), {
      method: "post", action: "/app/chat/admin", encType: "application/json",
    });
    setSessions(prev => prev.map(s => s.sessionId === activeSession.sessionId ? { ...s, isResolved: true, resolvedAt: new Date().toISOString() } : s));
    setActiveSession(prev => ({ ...prev, isResolved: true, resolvedAt: new Date().toISOString() }));
  };

  const handleReopenChat = async () => {
    if (!activeSession) return;
    fetcher.submit(JSON.stringify({ action: "unresolve", sessionId: activeSession.sessionId }), {
      method: "post", action: "/app/chat/admin", encType: "application/json",
    });
    setSessions(prev => prev.map(s => s.sessionId === activeSession.sessionId ? { ...s, isResolved: false, resolvedAt: null } : s));
    setActiveSession(prev => ({ ...prev, isResolved: false, resolvedAt: null }));
  };

  return (
    <div style={{ display:"flex", height:"100vh", backgroundColor:"#f9fafb", color:"#111827", fontFamily:'"Inter", system-ui, sans-serif' }}>

      {/* 🔥 FCM TOAST STACK — multiple messages stack upward, each auto-dismisses */}
      {adminToasts.length > 0 && (
        <div style={{
          position      : "fixed",
          bottom        : "32px",
          right         : "32px",
          zIndex        : 99999,
          display       : "flex",
          flexDirection : "column-reverse", // newest at bottom
          gap           : "10px",
          maxWidth      : "360px",
          width         : "360px",
          pointerEvents : "none", // container itself not clickable
        }}>
          {/* "Dismiss all" button — only shown when 2+ toasts */}
          {adminToasts.length >= 2 && (
            <div style={{ pointerEvents:"auto", display:"flex", justifyContent:"flex-end" }}>
              <button
                onClick={() => setAdminToasts([])}
                style={{
                  padding:"5px 12px", background:"rgba(0,0,0,0.55)", color:"white",
                  border:"none", borderRadius:"20px", fontSize:"11px", fontWeight:"600",
                  cursor:"pointer", backdropFilter:"blur(4px)",
                }}
              >
                ✕ Dismiss all ({adminToasts.length})
              </button>
            </div>
          )}

          {adminToasts.map((toast, idx) => (
            <div
              key={toast.id}
              onClick={() => {
                if (toast.sessionId) {
                  const s = sessions.find(s => s.sessionId === toast.sessionId);
                  if (s) loadChat(s);
                }
                setAdminToasts(prev => prev.filter(t => t.id !== toast.id));
              }}
              style={{
                pointerEvents : "auto",
                background    : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                color         : "white",
                borderRadius  : "16px",
                padding       : "14px 16px",
                boxShadow     : "0 6px 24px rgba(99,102,241,0.45)",
                display       : "flex",
                alignItems    : "flex-start",
                gap           : "12px",
                cursor        : toast.sessionId ? "pointer" : "default",
                animation     : "slideInRight 0.3s ease",
                border        : "1px solid rgba(255,255,255,0.15)",
                position      : "relative",
                overflow      : "hidden",
              }}
            >
              {/* Progress bar — auto-dismiss timer visual */}
              <div style={{
                position  : "absolute",
                bottom    : 0,
                left      : 0,
                height    : "3px",
                background: "rgba(255,255,255,0.4)",
                borderRadius: "0 0 0 16px",
                animation : "toastProgress 7s linear forwards",
                width     : "100%",
              }} />

              {/* Icon with message count badge if multiple */}
              <div style={{ position:"relative", flexShrink:0 }}>
                <div style={{ width:"38px", height:"38px", background:"rgba(255,255,255,0.2)", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px" }}>
                  💬
                </div>
                {idx === 0 && adminToasts.length > 1 && (
                  <div style={{
                    position:"absolute", top:"-6px", right:"-6px",
                    background:"#ef4444", color:"white", fontSize:"9px", fontWeight:"800",
                    width:"16px", height:"16px", borderRadius:"50%",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    border:"2px solid white",
                  }}>
                    {adminToasts.length}
                  </div>
                )}
              </div>

              <div style={{ flex:1, minWidth:0 }}>
                {/* Header row: title + timestamp */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"4px" }}>
                  <div style={{ fontWeight:"700", fontSize:"13px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"200px" }}>
                    {toast.title}
                  </div>
                  <div style={{ fontSize:"10px", opacity:0.6, flexShrink:0, marginLeft:"8px" }}>{toast.time}</div>
                </div>

                {/* Image preview — shown when message contains an image */}
                {toast.imageUrl && (
                  <div style={{ marginBottom:"6px", borderRadius:"8px", overflow:"hidden", maxHeight:"120px", background:"rgba(0,0,0,0.2)" }}>
                    <img
                      src={toast.imageUrl}
                      alt="attachment"
                      style={{ width:"100%", maxHeight:"120px", objectFit:"cover", borderRadius:"8px", display:"block" }}
                      onError={e => { e.currentTarget.style.display = "none"; }}
                    />
                  </div>
                )}

                {/* Body text */}
                <div style={{ fontSize:"12px", opacity:0.9, lineHeight:"1.45", wordBreak:"break-word" }}>
                  {toast.body}
                </div>

                {toast.sessionId && (
                  <div style={{ fontSize:"10px", opacity:0.65, marginTop:"5px", display:"flex", alignItems:"center", gap:"4px" }}>
                    <span>👆</span> Tap to open chat
                  </div>
                )}
              </div>

              {/* Close button */}
              <button
                onClick={e => {
                  e.stopPropagation();
                  setAdminToasts(prev => prev.filter(t => t.id !== toast.id));
                }}
                style={{
                  background:"rgba(255,255,255,0.2)", border:"none", color:"white",
                  width:"22px", height:"22px", borderRadius:"6px", cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  flexShrink:0, fontSize:"13px", fontWeight:"700", marginTop:"1px",
                }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* BLUR POPUP */}
      {showBlurPopup && (
        <div onClick={() => setShowBlurPopup(false)} style={{ position:"fixed", top:0, left:0, width:"100vw", height:"100vh", backgroundColor:"rgba(0,0,0,0.7)", zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)", cursor:"pointer" }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"white", borderRadius:"20px", padding:"40px", maxWidth:"500px", boxShadow:"0 20px 60px rgba(0,0,0,0.3)", cursor:"default", position:"relative" }}>
            <button onClick={() => setShowBlurPopup(false)} style={{ position:"absolute", top:"16px", right:"16px", background:"none", border:"none", cursor:"pointer", padding:"8px", borderRadius:"8px", display:"flex", alignItems:"center", justifyContent:"center" }}><Icons.X size={20} color="#9ca3af" /></button>
            <div style={{ width:"80px", height:"80px", borderRadius:"50%", background:"linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 24px", color:"white" }}><Icons.EyeOff /></div>
            <h2 style={{ fontSize:"24px", fontWeight:"700", color:"#111827", textAlign:"center", marginBottom:"12px" }}>Chat History Expired</h2>
            <p style={{ fontSize:"15px", color:"#6b7280", textAlign:"center", lineHeight:"1.6", marginBottom:"24px" }}>This chat is older than your <strong>FREE plan</strong> retention period (30 days). Upgrade to access full history.</p>
            <div style={{ display:"flex", gap:"12px" }}>
              <button onClick={() => setShowBlurPopup(false)} style={{ flex:1, padding:"14px 20px", borderRadius:"10px", border:"2px solid #e5e7eb", background:"#fff", color:"#6b7280", fontWeight:"600", fontSize:"14px", cursor:"pointer" }}>Maybe Later</button>
              <button onClick={goToSubscription} style={{ flex:1, padding:"14px 20px", borderRadius:"10px", border:"none", background:"linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)", color:"#fff", fontWeight:"600", fontSize:"14px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}><Icons.Zap />Upgrade Now</button>
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={{ position:"fixed", top:0, left:0, width:"100vw", height:"100vh", backgroundColor:"rgba(0,0,0,0.95)", zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)", cursor:"zoom-out" }}>
          <img src={selectedImage} style={{ maxWidth:"90%", maxHeight:"90%", borderRadius:"12px" }} alt="Preview" />
        </div>
      )}

      {/* ════ SIDEBAR ════ */}
      <div style={{ width:"360px", borderRight:"1px solid #e5e7eb", display:"flex", flexDirection:"column", background:"#fff" }}>
        <div style={{ padding:"20px 24px 16px", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <h2 style={{ fontSize:"24px", fontWeight:"700", color:"#111827", margin:0 }}>Messages</h2>
            <p style={{ fontSize:"13px", color:"#6b7280", marginTop:4, marginBottom:0 }}>
              Manage customer conversations
              {fcmReady && (
                <span style={{ marginLeft:"8px", background:"#d1fae5", color:"#065f46", fontSize:"10px", fontWeight:"700", padding:"2px 6px", borderRadius:"4px" }}>
                  🔥 FCM ON
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handlePushToggle}
            disabled={pushLoading}
            title={pushEnabled ? "Push notifications band karo" : "Push notifications chalu karo"}
            style={{ marginTop:"4px", padding:"8px 12px", borderRadius:"10px", border:pushEnabled?"2px solid #10b981":"2px solid #e5e7eb", background:pushEnabled?"linear-gradient(135deg, #d1fae5, #a7f3d0)":"#f9fafb", color:pushEnabled?"#065f46":"#6b7280", fontWeight:"700", fontSize:"12px", cursor:pushLoading?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:"6px", transition:"all 0.2s", opacity:pushLoading?0.6:1, whiteSpace:"nowrap", flexShrink:0, boxShadow:pushEnabled?"0 2px 8px rgba(16,185,129,0.2)":"none" }}
          >
            {pushLoading ? <span style={{ fontSize:"14px" }}>⏳</span> : pushEnabled ? <Icons.Bell /> : <Icons.BellOff />}
            {pushLoading ? "Wait..." : pushEnabled ? "Notif ON" : "Notif OFF"}
          </button>
        </div>

        {/* VAPID push enabled banner */}
        {pushEnabled && (
          <div style={{ margin:"0 16px 8px", padding:"8px 12px", background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:"8px", fontSize:"11px", color:"#166534", display:"flex", alignItems:"center", gap:"6px" }}>
            <span>🔔</span>
            {/* <span><strong>Push ON</strong> — Customer message kare toh browser notification aayega</span> */}
          </div>
        )}

        {/* ✅ NEW: "Enable Notifications" banner — shown when permission is default (not yet asked) */}
        {/* ════ PERMISSION MODAL — Mode A: not asked yet | Mode B: blocked ════ */}
        {showPermissionGuide && (
          <div
            onClick={() => setShowPermissionGuide(false)}
            style={{
              position:"fixed", top:0, left:0, width:"100vw", height:"100vh",
              background:"rgba(0,0,0,0.65)", zIndex:99998, display:"flex",
              alignItems:"center", justifyContent:"center", backdropFilter:"blur(6px)",
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background:"white", borderRadius:"20px", padding:"28px 32px",
                maxWidth:"440px", width:"92%", boxShadow:"0 24px 64px rgba(0,0,0,0.3)",
                position:"relative",
              }}
            >
              <button
                onClick={() => setShowPermissionGuide(false)}
                style={{ position:"absolute", top:"14px", right:"14px", background:"#f3f4f6", border:"none", borderRadius:"8px", width:"30px", height:"30px", cursor:"pointer", fontSize:"16px", display:"flex", alignItems:"center", justifyContent:"center", color:"#6b7280" }}
              >x</button>

              {notifPermission !== "denied" ? (
                <div>
                  <div style={{ textAlign:"center", marginBottom:"20px" }}>
                    <div style={{ fontSize:"44px", marginBottom:"10px" }}>🔔</div>
                    <h2 style={{ margin:0, fontSize:"19px", fontWeight:"800", color:"#111827" }}>Enable Notifications</h2>
                    <p style={{ margin:"8px 0 0", fontSize:"13px", color:"#6b7280", lineHeight:"1.6" }}>
                      Click Allow when your browser asks. That is all — done in one click!
                    </p>
                  </div>
                  <div style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:"12px", padding:"14px 16px", marginBottom:"20px", display:"flex", gap:"12px", alignItems:"flex-start" }}>
                    <span style={{ fontSize:"22px", flexShrink:0 }}>💡</span>
                    <div style={{ fontSize:"12px", color:"#0369a1", lineHeight:"1.6" }}>
                      A popup will appear asking permission for <strong>talksy-production-5d43.up.railway.app</strong> — click <strong>Allow</strong> and notifications will be active instantly.
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      setShowPermissionGuide(false);
                      await handleEnableNotifications();
                    }}
                    style={{
                      width:"100%", padding:"14px",
                      background:"linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                      color:"white", border:"none", borderRadius:"12px", fontWeight:"800",
                      fontSize:"15px", cursor:"pointer", boxShadow:"0 4px 16px rgba(99,102,241,0.4)",
                      display:"flex", alignItems:"center", justifyContent:"center", gap:"8px",
                    }}
                  >
                    🔔 Allow Notifications
                  </button>
                  <p style={{ textAlign:"center", fontSize:"11px", color:"#9ca3af", marginTop:"10px", marginBottom:0 }}>
                    You can turn off notifications anytime from browser settings.
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ textAlign:"center", marginBottom:"20px" }}>
                    <div style={{ fontSize:"44px", marginBottom:"10px" }}>🚫</div>
                    <h2 style={{ margin:0, fontSize:"19px", fontWeight:"800", color:"#dc2626" }}>Notifications Blocked</h2>
                    <p style={{ margin:"8px 0 0", fontSize:"13px", color:"#6b7280", lineHeight:"1.6" }}>
                      You previously blocked notifications. Follow 3 steps to fix:
                    </p>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"10px", marginBottom:"20px" }}>
                    <div style={{ background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:"10px", padding:"12px 14px", display:"flex", gap:"12px" }}>
                      <div style={{ width:"24px", height:"24px", borderRadius:"50%", background:"#6366f1", color:"white", fontSize:"12px", fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>1</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:"700", fontSize:"12px", color:"#111827", marginBottom:"4px" }}>🌐 Open Chrome Notification Settings</div>
                        <div style={{ fontSize:"11px", color:"#6b7280", marginBottom:"8px" }}>Open a new Chrome tab, paste this URL and press Enter:</div>
                        <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
                          <code style={{ flex:1, background:"#f3f4f6", padding:"5px 8px", borderRadius:"5px", fontSize:"10px", color:"#111827", fontFamily:"monospace" }}>chrome://settings/content/notifications</code>
                          <button
                            onClick={() => { navigator.clipboard.writeText("chrome://settings/content/notifications").catch(() => {}); }}
                            style={{ flexShrink:0, padding:"5px 8px", background:"#6366f1", color:"white", border:"none", borderRadius:"5px", fontSize:"10px", fontWeight:"700", cursor:"pointer" }}
                          >Copy</button>
                        </div>
                      </div>
                    </div>
                    <div style={{ background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:"10px", padding:"12px 14px", display:"flex", gap:"12px" }}>
                      <div style={{ width:"24px", height:"24px", borderRadius:"50%", background:"#6366f1", color:"white", fontSize:"12px", fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>2</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:"700", fontSize:"12px", color:"#111827", marginBottom:"4px" }}>🗑️ Delete the block for Talksy</div>
                        <div style={{ fontSize:"11px", color:"#6b7280", marginBottom:"8px" }}>Under "Not allowed", find this site and click the trash icon:</div>
                        <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
                          <code style={{ flex:1, background:"#fee2e2", padding:"5px 8px", borderRadius:"5px", fontSize:"10px", color:"#991b1b", fontFamily:"monospace", wordBreak:"break-all" }}>talksy-production-5d43.up.railway.app</code>
                          <button
                            onClick={() => { navigator.clipboard.writeText("talksy-production-5d43.up.railway.app").catch(() => {}); }}
                            style={{ flexShrink:0, padding:"5px 8px", background:"#ef4444", color:"white", border:"none", borderRadius:"5px", fontSize:"10px", fontWeight:"700", cursor:"pointer" }}
                          >Copy</button>
                        </div>
                      </div>
                    </div>
                    <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:"10px", padding:"12px 14px", display:"flex", gap:"12px" }}>
                      <div style={{ width:"24px", height:"24px", borderRadius:"50%", background:"#10b981", color:"white", fontSize:"12px", fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>3</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:"700", fontSize:"12px", color:"#065f46", marginBottom:"4px" }}>✅ Return here and click Retry</div>
                        <div style={{ fontSize:"11px", color:"#6b7280" }}>After deleting the block, come back to this tab and click the button below.</div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      setShowPermissionGuide(false);
                      const realPerm = "Notification" in window ? Notification.permission : "denied";
                      if (realPerm === "granted") {
                        setNotifBlocked(false);
                        setNotifPermission("granted");
                        fcmInitRef.current = false;
                        await initFCM();
                      } else if (realPerm === "default") {
                        setNotifBlocked(false);
                        setNotifPermission("default");
                      }
                    }}
                    style={{
                      width:"100%", padding:"13px",
                      background:"linear-gradient(135deg, #ea580c 0%, #dc2626 100%)",
                      color:"white", border:"none", borderRadius:"12px", fontWeight:"800",
                      fontSize:"14px", cursor:"pointer", boxShadow:"0 4px 14px rgba(220,38,38,0.35)",
                    }}
                  >
                    I removed the block — Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ✅ Unified notification banner — one for all states */}
        {!fcmReady && notifPermission !== "granted" && (
          <div style={{
            margin      : "0 16px 8px",
            padding     : "12px 14px",
            background  : notifPermission === "denied" ? "linear-gradient(135deg, #fff7ed, #fef2f2)" : "linear-gradient(135deg, #eff6ff, #f5f3ff)",
            border      : notifPermission === "denied" ? "1px solid #fca5a5" : "1px solid #c7d2fe",
            borderRadius: "12px",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
              <span style={{ fontSize:"20px" }}>{notifPermission === "denied" ? "🚫" : "🔔"}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:"700", fontSize:"12px", color: notifPermission === "denied" ? "#991b1b" : "#3730a3", marginBottom:"2px" }}>
                  {notifPermission === "denied" ? "Notifications Blocked" : "Notifications not enabled"}
                </div>
                <div style={{ fontSize:"11px", color:"#6b7280", lineHeight:"1.4" }}>
                  {notifPermission === "denied" ? "You previously blocked alerts. Tap below to fix." : "Get instant alerts when customers message you."}
                </div>
              </div>
            </div>
            <button
              onClick={async () => {
                if (notifPermission === "denied") {
                  setShowPermissionGuide(true);
                } else {
                  await handleEnableNotifications();
                }
              }}
              style={{
                width:"100%", padding:"9px",
                background: notifPermission === "denied"
                  ? "linear-gradient(135deg, #ea580c 0%, #dc2626 100%)"
                  : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                color:"white", border:"none", borderRadius:"8px",
                fontWeight:"700", fontSize:"12px", cursor:"pointer",
                boxShadow:"0 2px 8px rgba(99,102,241,0.3)",
              }}
            >
              {notifPermission === "denied" ? "🔓 Fix Notifications" : "🔔 Enable Notifications"}
            </button>
          </div>
        )}

        {planLimit.isOverLimit && (
          <div style={{ margin:"0 16px 16px", padding:"14px", background:"linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)", borderRadius:"12px", color:"white", boxShadow:"0 4px 12px rgba(124,58,237,0.3)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"8px" }}>
              <Icons.AlertTriangle />
              <div style={{ fontSize:"13px", fontWeight:"700" }}>Over Plan Limit (+{planLimit.overLimitBy} extra)</div>
            </div>
            <div style={{ fontSize:"12px", opacity:0.95, lineHeight:"1.4" }}>{planLimit.overLimitBy} customer{planLimit.overLimitBy!==1?"s":""} waiting.</div>
            <button onClick={goToSubscription} style={{ marginTop:"10px", padding:"8px 14px", background:"white", color:"#7c3aed", border:"none", borderRadius:"8px", fontWeight:"600", fontSize:"12px", cursor:"pointer", width:"100%" }}>Upgrade to Continue</button>
          </div>
        )}

        <div style={{ padding:"0 16px 16px", display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:"6px", borderBottom:"1px solid #f3f4f6" }}>
          {[
            { key:"all",      label:`All (${withinLimitSessions.length})`,                                    bg:"#6366f1" },
            { key:"pending",  label:`Pending (${withinLimitSessions.filter(s=>!s.isResolved).length})`,       bg:"#f59e0b" },
            { key:"resolved", label:`Resolved (${withinLimitSessions.filter(s=>s.isResolved).length})`,       bg:"#10b981" },
            { key:"requests", label:`Requests (${overLimitSessions.length})`,                                  bg:"#7c3aed", icon:<Icons.Inbox /> },
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilterStatus(tab.key)} style={{ padding:"8px 12px", borderRadius:"8px", border:filterStatus===tab.key?"none":"1px solid #e5e7eb", background:filterStatus===tab.key?tab.bg:"#fff", color:filterStatus===tab.key?"#fff":"#6b7280", fontWeight:"600", fontSize:"12px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"4px", transition:"all 0.2s" }}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding:"16px" }}>
          <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
            <span style={{ position:"absolute", left:"12px", color:"#9ca3af" }}><Icons.Search /></span>
            <input placeholder="Search conversations..." style={{ width:"100%", padding:"10px 10px 10px 40px", borderRadius:"10px", border:"1px solid #e5e7eb", outline:"none", fontSize:"14px" }} onChange={e => setSearchTerm(e.target.value)} value={searchTerm} />
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"0 12px" }}>
          {filteredSessions.map(session => (
            <div key={session.sessionId} onClick={() => loadChat(session)} style={{ position:"relative", padding:"12px", borderRadius:"12px", cursor:"pointer", marginBottom:"6px", background:activeSession?.sessionId===session.sessionId?"#f0f9ff":"transparent", border:activeSession?.sessionId===session.sessionId?"1px solid #bae6fd":"1px solid transparent", transition:"all 0.2s", opacity:session.shouldBlur?0.6:1 }}>
              <div style={{ display:"flex", gap:"12px", alignItems:"center" }}>
                <div style={{ width:"44px", height:"44px", borderRadius:"12px", background:session.shouldBlur?"#fef3c7":(activeSession?.sessionId===session.sessionId?"linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)":(session.isOverLimit?"#fef3c7":"#f3f4f6")), display:"flex", alignItems:"center", justifyContent:"center", color:session.shouldBlur?"#92400e":(activeSession?.sessionId===session.sessionId?"white":(session.isOverLimit?"#92400e":"#9ca3af")), flexShrink:0 }}>
                  {session.shouldBlur ? <Icons.EyeOff /> : session.isOverLimit ? <Icons.Lock /> : <Icons.User size={20} />}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:2 }}>
                    <div style={{ fontWeight:"600", fontSize:"14px", color:"#111827" }}>{session.email?.split("@")[0] || "User"}</div>
                    {session.isResolved && <div style={{ background:"#10b981", borderRadius:"50%", width:"20px", height:"20px", display:"flex", alignItems:"center", justifyContent:"center" }}><Icons.Check /></div>}
                    {session.shouldBlur && <div style={{ background:"#f59e0b", color:"white", fontSize:"9px", fontWeight:"700", padding:"2px 6px", borderRadius:"4px" }}>EXPIRED</div>}
                    {session.isOverLimit && !session.shouldBlur && <div style={{ background:"#f59e0b", color:"white", fontSize:"9px", fontWeight:"700", padding:"2px 6px", borderRadius:"4px" }}>REQUEST</div>}
                  </div>
                  <div style={{ fontSize:"12px", color:"#6b7280", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {session.shouldBlur ? "Chat history expired" : (session.messages[0]?.message || "New Chat")}
                  </div>
                </div>
                {unreadCounts[session.sessionId] > 0 && (
                  <div style={{ background:"#ef4444", color:"white", fontSize:"10px", fontWeight:"700", padding:"4px 8px", borderRadius:"10px", minWidth:"20px", textAlign:"center" }}>
                    {unreadCounts[session.sessionId]}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ════ CHAT AREA ════ */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", background:"#fff" }}>
        {activeSession ? (
          <>
            <div style={{ padding:"20px 32px", borderBottom:"1px solid #e5e7eb", display:"flex", justifyContent:"space-between", alignItems:"center", background:isActiveSessionBlurred?"#fef3c7":(isActiveSessionOverLimit?"#fef3c7":"#fff") }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                  <h3 style={{ margin:0, fontWeight:"700", fontSize:"18px", color:"#111827" }}>{activeSession.email}</h3>
                  {isActiveSessionBlurred && <div style={{ background:"#ef4444", color:"white", fontSize:"11px", fontWeight:"700", padding:"4px 10px", borderRadius:"6px", display:"flex", alignItems:"center", gap:"4px" }}><Icons.EyeOff />Expired</div>}
                  {isActiveSessionOverLimit && !isActiveSessionBlurred && <div style={{ background:"#f59e0b", color:"white", fontSize:"11px", fontWeight:"700", padding:"4px 10px", borderRadius:"6px", display:"flex", alignItems:"center", gap:"4px" }}><Icons.Lock />Over Limit</div>}
                  {activeSession.isResolved && !isActiveSessionOverLimit && !isActiveSessionBlurred && <div style={{ background:"#d1fae5", color:"#065f46", fontSize:"11px", fontWeight:"700", padding:"4px 10px", borderRadius:"6px", display:"flex", alignItems:"center", gap:"4px" }}><Icons.Check />Resolved</div>}
                </div>
                {isActiveSessionBlurred && <div style={{ fontSize:"12px", color:"#dc2626", marginTop:"4px", fontWeight:"500" }}>Chat expired — older than retention period</div>}
                {isActiveSessionOverLimit && !isActiveSessionBlurred && <div style={{ fontSize:"12px", color:"#92400e", marginTop:"4px", fontWeight:"500" }}>This chat is over your plan limit. Upgrade to respond.</div>}
                {activeSession.resolvedAt && !isActiveSessionOverLimit && !isActiveSessionBlurred && <div style={{ fontSize:"12px", color:"#6b7280", marginTop:"4px" }}>Resolved on {new Date(activeSession.resolvedAt).toLocaleDateString()}</div>}
              </div>
              {isActiveSessionBlurred ? (
                <button onClick={goToSubscription} style={{ padding:"10px 18px", borderRadius:"10px", border:"none", background:"#ef4444", color:"#fff", fontWeight:"600", fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" }}><Icons.Zap />Upgrade to View</button>
              ) : !isActiveSessionOverLimit && !activeSession.isResolved ? (
                <button onClick={handleMarkResolved} style={{ padding:"10px 18px", borderRadius:"10px", border:"none", background:"linear-gradient(135deg, #10b981 0%, #059669 100%)", color:"#fff", fontWeight:"600", fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px", boxShadow:"0 4px 12px rgba(16,185,129,0.25)" }}><Icons.CheckCircle />Mark as Resolved</button>
              ) : !isActiveSessionOverLimit && activeSession.isResolved ? (
                <button onClick={handleReopenChat} style={{ padding:"10px 18px", borderRadius:"10px", border:"2px solid #f59e0b", background:"#fff", color:"#f59e0b", fontWeight:"600", fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" }}><Icons.RotateCcw />Reopen Chat</button>
              ) : (
                <button onClick={goToSubscription} style={{ padding:"10px 18px", borderRadius:"10px", border:"none", background:"#f59e0b", color:"#fff", fontWeight:"600", fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" }}><Icons.TrendingUp />Upgrade Plan</button>
              )}
            </div>

            <div ref={scrollRef} style={{ flex:1, padding:"32px", overflowY:"auto", display:"flex", flexDirection:"column", gap:"20px", background:"#f9fafb", filter:isActiveSessionBlurred?"blur(4px)":"none", pointerEvents:isActiveSessionBlurred?"none":"auto", userSelect:isActiveSessionBlurred?"none":"auto", opacity:isActiveSessionBlurred?0.5:1 }}>
              {messages.map((msg, i) => (
                <div key={msg.id||i} style={{ alignSelf:msg.sender==="admin"?"flex-end":"flex-start", maxWidth:"65%" }}>
                  <div style={{ padding:"12px 16px", borderRadius:"16px", background:msg.sender==="admin"?"linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)":(msg.sender==="bot"?"#fef3c7":"#fff"), color:msg.sender==="admin"?"#fff":"#111827", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", border:msg.sender==="admin"?"none":(msg.sender==="bot"?"1px solid #fbbf24":"1px solid #e5e7eb") }}>
                    {msg.fileUrl ? (
                      msg.fileUrl.includes("image") || msg.fileUrl.startsWith("data:image") ?
                        <img src={msg.fileUrl} onClick={() => setSelectedImage(msg.fileUrl)} style={{ maxWidth:"280px", borderRadius:"10px", cursor:"zoom-in" }} alt="attachment" /> :
                        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}><Icons.FileText /><a href={msg.fileUrl} target="_blank" rel="noreferrer" style={{ color:"inherit", fontWeight:"600", textDecoration:"none" }}>View Document</a></div>
                    ) : (
                      <div style={{ fontSize:"14px", lineHeight:"1.5" }}>{msg.message}</div>
                    )}
                  </div>
                  <div style={{ fontSize:"11px", color:"#9ca3af", marginTop:"4px", textAlign:msg.sender==="admin"?"right":"left" }}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
                  </div>
                </div>
              ))}
            </div>

            {filePreview && !isActiveSessionOverLimit && (
              <div style={{ padding:"12px 32px", background:"#fef3c7", borderTop:"2px solid #fbbf24", display:"flex", alignItems:"center", gap:"12px" }}>
                <div style={{ position:"relative" }}>
                  {filePreview.type.includes("image") ? <img src={filePreview.url} style={{ height:"50px", width:"50px", objectFit:"cover", borderRadius:"8px", border:"1px solid #e5e7eb" }} alt="preview" /> : <div style={{ height:"50px", width:"50px", background:"#f3f4f6", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:"8px" }}><Icons.FileText /></div>}
                  <button onClick={() => setFilePreview(null)} style={{ position:"absolute", top:"-6px", right:"-6px", background:"#ef4444", borderRadius:"50%", border:"none", cursor:"pointer", padding:"4px", display:"flex" }}><Icons.X size={12} color="white" /></button>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:"13px", fontWeight:"600", color:"#111827" }}>{filePreview.name}</div>
                  <div style={{ fontSize:"11px", color:"#6b7280" }}>Ready to send</div>
                </div>
              </div>
            )}

            {!isActiveSessionOverLimit && !isActiveSessionBlurred ? (
              <div style={{ padding:"20px 32px", background:"#fff", borderTop:"1px solid #e5e7eb", position:"relative" }}>
                {showEmojiPicker && (
                  <div style={{ position:"absolute", bottom:"80px", left:"32px", background:"white", padding:"12px", borderRadius:"12px", boxShadow:"0 10px 25px rgba(0,0,0,0.15)", border:"1px solid #e5e7eb", display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:"8px", zIndex:10 }}>
                    {emojis.map(e => <button key={e} onClick={() => addEmoji(e)} style={{ background:"none", border:"none", fontSize:"22px", cursor:"pointer", padding:"6px", borderRadius:"8px" }}>{e}</button>)}
                  </div>
                )}
                <div style={{ display:"flex", alignItems:"center", background:"#f9fafb", borderRadius:"12px", padding:"6px 8px", border:"1px solid #e5e7eb" }}>
                  <input type="file" ref={fileInputRef} style={{ display:"none" }} onChange={handleFileSelect} accept="image/*,.pdf" />
                  <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background:"none", border:"none", cursor:"pointer", color:showEmojiPicker?accentColor:"#9ca3af", padding:"8px" }}><Icons.Smile /></button>
                  <button onClick={() => fileInputRef.current.click()} style={{ background:"none", border:"none", cursor:"pointer", margin:"0 8px", color:"#9ca3af", padding:"8px" }}><Icons.Paperclip /></button>
                  <input placeholder="Type a message..." style={{ flex:1, border:"none", background:"transparent", outline:"none", fontSize:"14px", color:"#111827" }} value={reply} onChange={e => setReply(e.target.value)} onKeyPress={e => { if (e.key==="Enter") handleReply(); }} />
                  <button onClick={() => handleReply()} style={{ width:"40px", height:"40px", borderRadius:"10px", background:(reply.trim()||filePreview)?"linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)":"#e5e7eb", border:"none", color:"white", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><Icons.Send /></button>
                </div>
              </div>
            ) : isActiveSessionBlurred ? (
              <div style={{ padding:"20px 32px", background:"#fee2e2", borderTop:"2px solid #ef4444" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"16px", background:"white", borderRadius:"12px", border:"2px dashed #ef4444" }}>
                  <Icons.EyeOff />
                  <div style={{ flex:1 }}><div style={{ fontSize:"14px", fontWeight:"600", color:"#dc2626", marginBottom:"4px" }}>Chat Expired</div><div style={{ fontSize:"12px", color:"#dc2626" }}>Upgrade to access full history.</div></div>
                  <button onClick={goToSubscription} style={{ padding:"8px 16px", background:"#ef4444", color:"white", border:"none", borderRadius:"8px", fontWeight:"600", fontSize:"12px", cursor:"pointer" }}>Upgrade Now</button>
                </div>
              </div>
            ) : (
              <div style={{ padding:"20px 32px", background:"#fef3c7", borderTop:"2px solid #fbbf24" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"16px", background:"white", borderRadius:"12px", border:"2px dashed #f59e0b" }}>
                  <Icons.Lock />
                  <div style={{ flex:1 }}><div style={{ fontSize:"14px", fontWeight:"600", color:"#92400e", marginBottom:"4px" }}>Chat Locked — Over Plan Limit</div><div style={{ fontSize:"12px", color:"#92400e" }}>Upgrade to respond to this customer.</div></div>
                  <button onClick={goToSubscription} style={{ padding:"8px 16px", background:"#f59e0b", color:"white", border:"none", borderRadius:"8px", fontWeight:"600", fontSize:"12px", cursor:"pointer" }}>Upgrade Now</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#d1d5db", gap:"16px", background:"#f9fafb" }}>
            <Icons.User size={80} />
            <p style={{ fontWeight:"600", fontSize:"16px", color:"#9ca3af" }}>Select a conversation to start chatting</p>
          </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div style={{ width:"320px", padding:"24px", background:"#fff", borderLeft:"1px solid #e5e7eb" }}>
        <h4 style={{ fontSize:"11px", fontWeight:"700", color:"#9ca3af", textTransform:"uppercase", letterSpacing:"1px", marginBottom:20 }}>Chat Details</h4>
        <div style={{ marginBottom:"16px", padding:"16px", background:planLimit.isOverLimit?"#fef3c7":(planLimit.isAtLimit?"#fee2e2":(planLimit.isNearLimit?"#fef3c7":"#eff6ff")), borderRadius:"12px", border:planLimit.isOverLimit?"1px solid #fcd34d":(planLimit.isAtLimit?"1px solid #fca5a5":(planLimit.isNearLimit?"1px solid #fcd34d":"1px solid #bfdbfe")) }}>
          <div style={{ fontSize:"10px", color:planLimit.isOverLimit?"#92400e":(planLimit.isAtLimit?"#991b1b":(planLimit.isNearLimit?"#92400e":"#1e40af")), fontWeight:"700", marginBottom:"8px", letterSpacing:"0.5px" }}>PLAN USAGE</div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"8px" }}><Icons.TrendingUp /><span style={{ fontSize:"24px", fontWeight:"800", color:planLimit.isOverLimit?"#92400e":"#1e40af" }}>{planLimit.max>0?`${withinLimitSessions.length}/${planLimit.max}`:sessions.length}</span></div>
          <div style={{ fontSize:"11px", color:planLimit.isOverLimit?"#92400e":"#60a5fa" }}>{planLimit.isOverLimit?`${planLimit.overLimitBy} request${planLimit.overLimitBy!==1?"s":""} in queue`:planLimit.isAtLimit?"At limit — upgrade to continue":`${planLimit.remaining} chat${planLimit.remaining!==1?"s":""} remaining`}</div>
          {(planLimit.isAtLimit||planLimit.isOverLimit) && <button onClick={goToSubscription} style={{ marginTop:"12px", padding:"8px 12px", background:planLimit.isOverLimit?"#f59e0b":"#dc2626", color:"white", border:"none", borderRadius:"8px", fontWeight:"600", fontSize:"12px", cursor:"pointer", width:"100%" }}>Upgrade Now</button>}
        </div>

        {activeSession && (
          <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
            <div style={{ padding:"16px", background:activeSession.isResolved?"#d1fae5":(isActiveSessionOverLimit?"#fee2e2":"#fef3c7"), borderRadius:"12px", border:activeSession.isResolved?"1px solid #86efac":(isActiveSessionOverLimit?"1px solid #fca5a5":"1px solid #fcd34d") }}>
              <div style={{ fontSize:"10px", color:activeSession.isResolved?"#065f46":(isActiveSessionOverLimit?"#991b1b":"#92400e"), fontWeight:"700", marginBottom:"8px", letterSpacing:"0.5px" }}>STATUS</div>
              <div style={{ display:"flex", alignItems:"center", gap:"8px", fontWeight:"700", fontSize:"15px", color:activeSession.isResolved?"#065f46":(isActiveSessionOverLimit?"#991b1b":"#92400e") }}>
                {activeSession.isResolved?<Icons.CheckCircle />:isActiveSessionOverLimit?<Icons.Lock />:<Icons.AlertCircle />}
                {activeSession.isResolved?"Resolved":isActiveSessionOverLimit?"Over Limit":"Pending"}
              </div>
            </div>
            <div style={{ padding:"16px", background:"#f9fafb", borderRadius:"12px", border:"1px solid #e5e7eb" }}>
              <div style={{ fontSize:"10px", color:"#9ca3af", fontWeight:"700", marginBottom:"8px", letterSpacing:"0.5px" }}>LOCAL TIME</div>
              <div style={{ display:"flex", alignItems:"center", gap:"8px", fontWeight:"600", fontSize:"14px", color:"#111827" }}><Icons.Clock />{new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</div>
            </div>
            <div style={{ padding:"16px", background:"#eff6ff", borderRadius:"12px", border:"1px solid #bfdbfe" }}>
              <div style={{ fontSize:"10px", color:"#1e40af", fontWeight:"700", marginBottom:"8px", letterSpacing:"0.5px" }}>MESSAGES</div>
              <div style={{ fontSize:"28px", fontWeight:"800", color:"#1e40af" }}>{messages.length}</div>
              <div style={{ fontSize:"11px", color:"#60a5fa", marginTop:4 }}>Total exchanges</div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes toastProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f3f4f6; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}