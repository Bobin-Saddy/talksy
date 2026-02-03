/**
 * admin-status.js
 * ─────────────────────────────────────────────────────────────
 * PURPOSE
 *   This module powers the green / red "We are online / offline"
 *   dot that appears on the chat widget's Contact-us card.
 *
 * HOW IT WORKS  (end-to-end)
 * ─────────────────────────────────────────────────────────────
 *  1. ADMIN SIDE  (Remix app – runs inside Shopify admin)
 *       • When the admin opens ANY page in the Talksy app the
 *         React hook  useAdminHeartbeat()  (see bottom of file)
 *         starts a 30-second timer.
 *       • Every tick it POSTs to  /api/admin-heartbeat
 *         with the shop domain.
 *       • The route handler  heartbeatAction()  upserts the
 *         AdminStatus row: sets isOnline = true and stamps
 *         lastHeartbeat = now().
 *       • When the admin closes / navigates away the browser
 *         tab fires an unload event; the hook sends a final
 *         POST { isOnline: false } so the status flips
 *         immediately instead of waiting for the timeout.
 *
 *  2. WIDGET SIDE  (Liquid snippet – runs on the storefront)
 *       • On init the widget calls  GET /api/admin-status?shop=…
 *         once, then repeats every 10 seconds.
 *       • The route handler  statusLoader()  reads the
 *         AdminStatus row.
 *       • If  lastHeartbeat  is older than 60 seconds the
 *         response is  { online: false }.  Otherwise  { online: true }.
 *       • The widget JS  applyStatus()  flips the dot colour
 *         and label text accordingly.
 *
 * TIMEOUT MATH
 *   Heartbeat interval : 30 s
 *   Stale threshold    : 60 s   (≈ 2 × heartbeat interval)
 *   → Worst-case delay before "offline" appears : ~60 s
 *     (admin closes tab without firing unload)
 *   Widget poll interval : 10 s
 *   → Worst-case delay widget notices a change   : ~10 s
 *   Total worst-case latency                     : ~70 s
 *
 * FILES THAT USE THIS MODULE
 *   • routes/api.admin-heartbeat.ts   – import heartbeatAction
 *   • routes/api.admin-status.ts      – import statusLoader
 *   • Any Remix layout / page         – import useAdminHeartbeat
 * ─────────────────────────────────────────────────────────────
 */

import prisma from "../db.server";   // adjust path to your prisma client

/* ────────────────────────────────────────────
   CONSTANTS
   ──────────────────────────────────────────── */
const STALE_THRESHOLD_MS = 60_000;   // 60 seconds – if no heartbeat in this window → offline

/* ════════════════════════════════════════════
   ROUTE 1 – POST /api/admin-heartbeat
   Called by the admin app every 30 s.
   Body: { shop: string, isOnline?: boolean }
   ════════════════════════════════════════════ */
export async function heartbeatAction({ request }) {
  const body = await request.json();
  const shop = body.shop;

  if (!shop) {
    return new Response(JSON.stringify({ error: "shop is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // If the admin explicitly says "going offline" (tab close) honour it immediately
  const online =
    body.isOnline !== undefined ? body.isOnline : true;

  await prisma.adminStatus.upsert({
    where: { shop },
    update: {
      isOnline      : online,
      lastHeartbeat : new Date(),
    },
    create: {
      shop          : shop,
      isOnline      : online,
      lastHeartbeat : new Date(),
    },
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/* ════════════════════════════════════════════
   ROUTE 2 – GET /api/admin-status?shop=…
   Called by the storefront widget every 10 s.
   Returns { online: true | false }
   ════════════════════════════════════════════ */
export async function statusLoader({ request }) {
  const url  = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return new Response(JSON.stringify({ online: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const record = await prisma.adminStatus.findUnique({
    where: { shop },
  });

  // No record at all → never been online
  if (!record) {
    return new Response(JSON.stringify({ online: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check staleness: if lastHeartbeat is older than STALE_THRESHOLD → offline
  const elapsed = Date.now() - new Date(record.lastHeartbeat).getTime();
  const online  = record.isOnline && elapsed < STALE_THRESHOLD_MS;

  return new Response(JSON.stringify({ online }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/* ════════════════════════════════════════════
   REACT HOOK – useAdminHeartbeat(shop)
   Drop this into any Remix layout or page that
   the admin keeps open while using the app.
   It handles start, periodic tick, and cleanup
   (sends isOnline: false on unmount / tab close).
   ════════════════════════════════════════════ */
import { useEffect, useRef } from "react";  // React import – keep at top in real file

const HEARTBEAT_INTERVAL_MS = 30_000;       // 30 seconds
const BASE_URL              = "https://talksy-production-2e93.up.railway.app";

export function useAdminHeartbeat(shop) {
  const intervalRef = useRef(null);

  /* single heartbeat POST */
  async function ping(online = true) {
    try {
      await fetch(`${BASE_URL}/api/admin-heartbeat`, {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({ shop, isOnline: online }),
      });
    } catch (_) {
      // silently ignore – next tick will retry
    }
  }

  useEffect(() => {
    if (!shop) return;

    // ── immediate first ping ──
    ping(true);

    // ── start repeating every 30 s ──
    intervalRef.current = setInterval(() => ping(true), HEARTBEAT_INTERVAL_MS);

    // ── on tab close / navigate away → send offline signal ──
    const onUnload = () => {
      // navigator.sendBeacon is fire-and-forget – perfect for unload
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          `${BASE_URL}/api/admin-heartbeat`,
          JSON.stringify({ shop, isOnline: false })
        );
      }
      // fallback (some browsers block fetch in unload but allow sendBeacon)
    };

    window.addEventListener("beforeunload", onUnload);

    // ── cleanup on React unmount ──
    return () => {
      clearInterval(intervalRef.current);
      window.removeEventListener("beforeunload", onUnload);
      ping(false);   // explicit offline on unmount
    };
  }, [shop]);
}


